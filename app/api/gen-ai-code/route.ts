import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db, DB_TX_OPTS, isDbTransientError, runTransactionWithRetry } from "@/lib/prisma";
import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { Message, FileData } from "@/types/workspace";
import { generateWithOpenRouter, type AIStreamEvent } from "@/lib/ai";
import {
  getAutoGeminiModels,
  getGenerationModelById,
  getOpenRouterFallbackModel,
} from "@/lib/generation-models";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MAX_PRE_OUTPUT_RETRIES = 1;
const PRE_OUTPUT_RETRY_DELAY_MS = 2_000;

type StatusCallback = (message: string, resetOutput?: boolean) => void;

const PREINSTALLED_PACKAGES = [
  "lucide-react",
  "framer-motion",
  "recharts",
  "date-fns",
  "axios",
  "react-router-dom",
  "react-hook-form",
  "@hookform/resolvers",
  "zod",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-tabs",
  "@radix-ui/react-tooltip",
  "@radix-ui/react-accordion",
  "@radix-ui/react-select",
].join(", ");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCapacityError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as Error)?.message ?? "");
  return (
    status === 503 ||
    status === 429 ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand")
  );
}

function isMidStreamFailure(err: unknown): boolean {
  return Boolean((err as { midStreamFailure?: boolean })?.midStreamFailure);
}

function markMidStreamFailure(err: unknown): Error {
  const error =
    err instanceof Error ? err : new Error(String(err ?? "Model failed"));
  (error as Error & { midStreamFailure?: boolean }).midStreamFailure = true;
  return error;
}

function shouldTryNextModel(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as Error)?.message ?? "");
  if (status === 503 || status === 429) return true;
  if (status === 404 && (msg.includes("not found") || msg.includes("NOT_FOUND")))
    return true;
  return (
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("NOT_FOUND")
  );
}

function buildGeminiConfig() {
  return {
    systemInstruction: SYSTEM_PROMPT,
    temperature: 0.35,
    responseMimeType: "application/json" as const,
    maxOutputTokens: 16_384,
    thinkingConfig: { includeThoughts: true },
  };
}

async function* generateWithGeminiModel(
  modelId: string,
  contents: ReturnType<typeof buildContents>
): AsyncGenerator<AIStreamEvent> {
  let hasOutput = false;

  for (let attempt = 0; attempt <= MAX_PRE_OUTPUT_RETRIES; attempt++) {
    try {
      if (attempt > 0 && !hasOutput) {
        await sleep(PRE_OUTPUT_RETRY_DELAY_MS);
      }

      hasOutput = false;
      const stream = await ai.models.generateContentStream({
        model: modelId,
        contents,
        config: buildGeminiConfig(),
      });

      for await (const chunk of stream) {
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (!part.text) continue;
          hasOutput = true;
          yield {
            type: part.thought ? "thought" : "content",
            text: part.text,
          };
        }
      }
      return;
    } catch (err) {
      if (!shouldTryNextModel(err)) throw err;
      if (hasOutput) throw markMidStreamFailure(err);
      if (attempt < MAX_PRE_OUTPUT_RETRIES) continue;
      throw err;
    }
  }
}

async function* generateWithOpenRouterFallback(
  messages: Message[],
  fileData: FileData | null,
  modelId?: string
): AsyncGenerator<AIStreamEvent> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured");
  }
  yield* generateWithOpenRouter(
    messages,
    fileData,
    SYSTEM_PROMPT,
    modelId
  );
}

async function* generateWithModelFallback(
  messages: Message[],
  fileData: FileData | null,
  modelPreference: string,
  onStatus?: StatusCallback
): AsyncGenerator<AIStreamEvent> {
  const choice = getGenerationModelById(modelPreference);
  const contents = buildContents(messages, fileData);
  let lastError: unknown;

  if (choice.provider === "openrouter") {
    onStatus?.(`Generating with ${choice.label}…`);
    yield* generateWithOpenRouterFallback(messages, fileData, choice.id);
    return;
  }

  if (choice.provider === "google") {
    try {
      onStatus?.(`Generating with ${choice.label}…`);
      yield* generateWithGeminiModel(choice.id, contents);
      return;
    } catch (err) {
      lastError = err;
      if (!shouldTryNextModel(err) || !process.env.OPENROUTER_API_KEY) {
        throw err;
      }
      const fallback = getOpenRouterFallbackModel();
      console.warn(
        `[gen-ai-code] ${choice.id} failed, falling back to OpenRouter (${fallback.id}):`,
        err
      );
      onStatus?.(`Retrying with ${fallback.label}…`, true);
      yield* generateWithOpenRouterFallback(messages, fileData, fallback.id);
      return;
    }
  }

  const geminiModels = getAutoGeminiModels();

  for (let i = 0; i < geminiModels.length; i++) {
    const { id, label } = geminiModels[i];
    try {
      onStatus?.(
        i === 0 ? `Generating with ${label}…` : `Retrying with ${label}…`,
        i > 0
      );
      yield* generateWithGeminiModel(id, contents);
      return;
    } catch (err) {
      lastError = err;
      if (!shouldTryNextModel(err)) throw err;
      if (isMidStreamFailure(err)) break;
      console.warn(`[gen-ai-code] ${id} failed:`, err);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const fallback = getOpenRouterFallbackModel();
      console.warn(
        `[gen-ai-code] Gemini models failed, falling back to OpenRouter (${fallback.id})`
      );
      onStatus?.(`Retrying with ${fallback.label}…`, true);
      yield* generateWithOpenRouterFallback(messages, fileData, fallback.id);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({ type, ...(payload as object) })}\n\n`;
}

// ─── Extract short label from a Gemini thought chunk ─────────────────────────
// Gemini thoughts often start with a bold heading like **Verify Config**
// We extract that. If no bold heading, take the first sentence only.

function extractThoughtLabel(text: string): string | null {
  // Try to grab **bold heading** at the start
  const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  // Fall back to first sentence (up to first . or \n), capped at 60 chars
  const sentence = text.split(/[.\n]/)[0].trim();
  if (sentence.length >= 8 && sentence.length <= 80) return sentence;

  return null;
}

// ─── npm validation ───────────────────────────────────────────────────────────

async function validateDependencies(
  deps: Record<string, string>
): Promise<Record<string, string>> {
  const valid: Record<string, string> = {};
  await Promise.all(
    Object.entries(deps).map(async ([pkg, version]) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) valid[pkg] = version;
      } catch {
        // silently skip hallucinated packages
      }
    })
  );
  return valid;
}

// ─── History trimming ─────────────────────────────────────────────────────────

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior React engineer building polished, production-quality demo apps inside a live browser preview (Sandpack).

OUTPUT FORMAT (strict):
1. Respond with ONE valid JSON object only — no markdown fences, no commentary outside JSON.
2. Shape:
{
  "assistantMessage": "<1-2 sentences on what you built>",
  "title": "<short 2-4 word title>",
  "files": {
    "/App.js": { "code": "<full file content>" },
    "/components/Example.js": { "code": "<full file content>" }
  },
  "dependencies": {}
}

TECH STACK:
- React functional components + hooks. JavaScript only (no TypeScript).
- Tailwind CSS for ALL styling — modern, responsive, visually polished UI.
- Entry point is always /App.js with a default export.
- Do NOT add react, react-dom, or tailwindcss to dependencies.

PRE-INSTALLED (use freely, do NOT re-add to dependencies):
${PREINSTALLED_PACKAGES}

QUALITY BAR (always follow):
- Build something that looks like a real shipped product, not a homework exercise.
- Split UI into focused components under /components/ for anything beyond a trivial app.
- Use lucide-react for icons. Use framer-motion for animations when the user asks for motion, transitions, or animated icons.
- Use realistic mock data (names, numbers, copy) — never "Lorem ipsum" or "TODO".
- Responsive layout: mobile-first, proper spacing (p-4, gap-4), rounded-xl cards, subtle shadows, gradient accents where appropriate.
- Dark-theme friendly palettes (slate/zinc backgrounds, white/80 text).
- Accessible: semantic HTML, aria-labels on icon-only buttons, sufficient color contrast.
- Working interactivity: buttons toggle state, forms validate, lists filter/sort when relevant.
- Preview runs in a fixed-height iframe: use min-h-screen on the root, never h-screen overflow-hidden on the outermost wrapper.
- For flex column layouts, make the main list/content section scrollable with flex-1 min-h-0 overflow-y-auto — do not rely on the page body to scroll.
- No console errors: every import must exist in "files" or pre-installed packages above.

WHEN MODIFYING EXISTING CODE:
- Return ALL files (changed and unchanged) in "files".

IMAGE ATTACHMENTS:
- Match the attached image layout/style as closely as possible.`;

// ─── Gemini contents builder ──────────────────────────────────────────────────

function buildContents(messages: Message[], fileData: FileData | null) {
  const trimmed = trimHistory(messages);

  return trimmed.map((msg, idx) => {
    const role = msg.role === "assistant" ? "model" : "user";

    if (msg.role === "user") {
      const parts: object[] = [];

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

      parts.push({ text });
      return { role, parts };
    }

    return { role, parts: [{ text: msg.content }] };
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspaceId, userId, messages, fileData, modelPreference } = body as {
    workspaceId: string | null;
    userId: string;
    messages: Message[];
    fileData: FileData | null;
    modelPreference?: string;
  };

  if (!messages?.length) {
    return Response.json({ message: "No messages provided" }, { status: 400 });
  }

  // ── Arcjet: rate limit, prompt injection, sensitive info ──────────────────
  // detectPromptInjectionMessage requires the actual user text to inspect.

  // const arcjetReq = new Request(request.url, {
  //   method: request.method,
  //   headers: request.headers,
  //   body: JSON.stringify(body),
  // });

  // const lastUserMessage =
  //   [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  // const decision = await aj.protect(arcjetReq, {
  //   requested: 1,
  //   userId: clerkId,
  //   detectPromptInjectionMessage: lastUserMessage,
  // });

  // if (decision.isDenied()) {
  //   return Response.json(
  //     { message: decision.reason?.type ?? "Request blocked" },
  //     { status: 429 }
  //   );
  // }

  const user = await db.user.findUnique({
    where: { id: userId, clerkId },
    select: { id: true, credits: true },
  });

  if (!user)
    return Response.json({ message: "User not found" }, { status: 404 });
  if (user.credits < CREDIT_COST_PER_GENERATION) {
    return Response.json({ message: "Insufficient credits" }, { status: 402 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      try {
        let accumulated = ""; // final JSON output
        let lastEmitTime = 0; // throttle thought emissions

        for await (const event of generateWithModelFallback(
          messages,
          fileData,
          modelPreference ?? "auto",
          (message, resetOutput) => {
            if (resetOutput) {
              accumulated = "";
              lastEmitTime = 0;
            }
            enqueue(sseEvent("status", { message }));
          }
        )) {
          if (event.type === "thought") {
            const now = Date.now();
            if (now - lastEmitTime > 600) {
              const label = extractThoughtLabel(event.text);
              if (label) {
                enqueue(sseEvent("status", { message: label }));
                lastEmitTime = now;
              }
            }
          } else {
            accumulated += event.text;
          }
        }

        // ── Parse the complete JSON response ──────────────────────────────────

        let parsed: {
          assistantMessage: string;
          title?: string;
          files: Record<string, { code: string }>;
          dependencies: Record<string, string>;
        };

        try {
          parsed = JSON.parse(accumulated);
        } catch {
          enqueue(
            sseEvent("error", {
              message: "AI returned invalid JSON. Please try again.",
            })
          );
          controller.close();
          return;
        }

        const {
          assistantMessage,
          title: aiTitle,
          files,
          dependencies,
        } = parsed;

        if (!files || typeof files !== "object") {
          enqueue(
            sseEvent("error", {
              message: "AI response missing files. Please try again.",
            })
          );
          controller.close();
          return;
        }

        // ── Validate npm packages ──────────────────────────────────────────────

        enqueue(sseEvent("status", { message: "Validating packages…" }));
        const validatedDeps = await validateDependencies(dependencies ?? {});
        const newFileData: FileData = {
          files,
          dependencies: validatedDeps,
          title: aiTitle,
        };

        // ── Upsert workspace + deduct credit (single transaction) ──────────────

        enqueue(sseEvent("status", { message: "Saving…" }));

        const lastUserMessage = messages[messages.length - 1];
        const updatedMessages: Message[] = [
          ...messages,
          { role: "assistant", content: assistantMessage },
        ];

        const [workspace] = await runTransactionWithRetry(() =>
          db.$transaction(
            [
              workspaceId
                ? db.workspace.update({
                    where: { id: workspaceId, userId },
                    data: {
                      messages: updatedMessages as never,
                      fileData: newFileData as never,
                    },
                  })
                : db.workspace.create({
                    data: {
                      userId,
                      title: aiTitle ?? lastUserMessage.content.slice(0, 80),
                      messages: updatedMessages as never,
                      fileData: newFileData as never,
                    },
                  }),
              db.user.update({
                where: { id: userId },
                data: { credits: { decrement: CREDIT_COST_PER_GENERATION } },
              }),
            ],
            DB_TX_OPTS
          )
        );

        const updatedUser = await db.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });

        // ── Emit final result ──────────────────────────────────────────────────

        enqueue(
          sseEvent("done", {
            workspaceId: workspace.id,
            assistantMessage,
            fileData: newFileData,
            creditsRemaining:
              updatedUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
          })
        );
      } catch (err) {
        console.error("[gen-ai-code] stream error:", err);
        enqueue(
          sseEvent("error", {
            message: isCapacityError(err)
              ? "All models are busy right now. Please try again in a minute."
              : isDbTransientError(err)
                ? "Database is busy. Please try again."
                : "Something went wrong. Please try again.",
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300; // for vercel - 300s on Fluid
