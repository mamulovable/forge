import type { Message, FileData } from "@/types/workspace";

export type AIProvider = "google" | "openrouter";

export function selectProvider(): AIProvider {
  const env = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (env === "openrouter") return "openrouter";
  if (process.env.OPENROUTER_API_KEY && !env) return "openrouter";
  return "google";
}

export interface AIStreamEvent {
  type: "thought" | "content";
  text: string;
}

// ─── Google provider ────────────────────────────────────────────────────

async function* generateWithGoogle(
  messages: Message[],
  fileData: FileData | null,
  systemPrompt: string,
): AsyncGenerator<AIStreamEvent> {
  const { GoogleGenAI } = await import("@google/genai");

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const contents = buildGoogleContents(messages, fileData);

  const geminiStream = await ai.models.generateContentStream({
    model: "gemini-3.5-flash",
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
      responseMimeType: "application/json",
      thinkingConfig: { includeThoughts: true },
      maxOutputTokens: 8192,
    },
  });

  for await (const chunk of geminiStream) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (!part.text) continue;
      yield {
        type: part.thought ? "thought" : "content",
        text: part.text,
      };
    }
  }
}

function buildGoogleContents(
  messages: Message[],
  fileData: FileData | null,
) {
  const trimmed = trimHistory(messages);
  return trimmed.map((msg, idx) => {
    const role = msg.role === "assistant" ? "model" : "user";
    if (msg.role === "user") {
      let text = msg.content;
      if (msg.imageUrl) {
        text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background-image, etc.): ${msg.imageUrl}]\n\n${text}`;
      }
      const isLast = idx === trimmed.length - 1;
      if (isLast && fileData) {
        text +=
          "\n\nCurrent project files for context:\n" +
          JSON.stringify(fileData, null, 2);
      }
      return { role, parts: [{ text }] };
    }
    return { role, parts: [{ text: msg.content }] };
  });
}

// ─── OpenRouter provider ────────────────────────────────────────────────

async function* generateWithOpenRouter(
  messages: Message[],
  fileData: FileData | null,
  systemPrompt: string,
): AsyncGenerator<AIStreamEvent> {
  const { default: OpenAI } = await import("openai");

  const openai = new OpenAI({
    baseURL:
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
    defaultHeaders: {
      "HTTP-Referer":
        process.env.SITE_URL || "https://github.com/roadsidecoder/buildai",
      "X-OpenRouter-Title": "Forge - AI App Builder",
    },
  });

  const model = process.env.OPENROUTER_MODEL || "google/gemini-3.5-flash";
  const openAIMessages = buildOpenAIMessages(messages, fileData);

  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...openAIMessages,
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
    stream: true,
    max_tokens: 8192,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    // OpenRouter may expose reasoning tokens in delta
    const reasoning = (delta as unknown as { reasoning?: string }).reasoning;
    if (reasoning) {
      yield { type: "thought", text: reasoning };
    }

    if (delta.content) {
      yield { type: "content", text: delta.content };
    }
  }
}

function buildOpenAIMessages(
  messages: Message[],
  fileData: FileData | null,
) {
  const trimmed = trimHistory(messages);
  const result: { role: "user" | "assistant"; content: string }[] = [];

  for (const [idx, msg] of trimmed.entries()) {
    if (msg.role === "user") {
      let text = msg.content;
      if (msg.imageUrl) {
        text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background-image, etc.): ${msg.imageUrl}]\n\n${text}`;
      }
      const isLast = idx === trimmed.length - 1;
      if (isLast && fileData) {
        text +=
          "\n\nCurrent project files for context:\n" +
          JSON.stringify(fileData, null, 2);
      }
      result.push({ role: "user", content: text });
    } else {
      result.push({ role: "assistant", content: msg.content });
    }
  }

  return result;
}

// ─── History trimming ───────────────────────────────────────────────────

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}

// ─── Main entry ─────────────────────────────────────────────────────────

export async function* generateCodeStream(
  messages: Message[],
  fileData: FileData | null,
  systemPrompt: string,
): AsyncGenerator<AIStreamEvent> {
  const provider = selectProvider();
  if (provider === "google") {
    yield* generateWithGoogle(messages, fileData, systemPrompt);
  } else {
    yield* generateWithOpenRouter(messages, fileData, systemPrompt);
  }
}

// ─── Extract short label from a thought chunk ───────────────────────────

export function extractThoughtLabel(text: string): string | null {
  const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
  if (boldMatch) return boldMatch[1].trim();
  const sentence = text.split(/[.\n]/)[0].trim();
  if (sentence.length >= 8 && sentence.length <= 80) return sentence;
  return null;
}
