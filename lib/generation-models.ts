export type GenerationModelProvider = "auto" | "google" | "openrouter";

export interface GenerationModelOption {
  id: string;
  label: string;
  provider: GenerationModelProvider;
}

export const GENERATION_MODEL_STORAGE_KEY = "forge-generation-model";

export const DEFAULT_GENERATION_MODEL_ID = "auto";

export const OPENROUTER_FALLBACK_MODEL_ID =
  process.env.OPENROUTER_FALLBACK_MODEL || "z-ai/glm-5.2:nitro";

export const GENERATION_MODELS: GenerationModelOption[] = [
  { id: "auto", label: "Auto", provider: "auto" },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "google",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    provider: "google",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    provider: "google",
  },
  {
    id: "z-ai/glm-5.2:nitro",
    label: "GLM 5.2 Nitro",
    provider: "openrouter",
  },
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 (OpenRouter)",
    provider: "openrouter",
  },
];

const AUTO_GEMINI_MODELS = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
] as const;

export function getGenerationModelById(id: string): GenerationModelOption {
  return (
    GENERATION_MODELS.find((m) => m.id === id) ??
    GENERATION_MODELS[0]
  );
}

export function readStoredGenerationModelId(): string {
  if (typeof window === "undefined") return DEFAULT_GENERATION_MODEL_ID;
  try {
    const stored = localStorage.getItem(GENERATION_MODEL_STORAGE_KEY);
    if (stored && GENERATION_MODELS.some((m) => m.id === stored)) {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_GENERATION_MODEL_ID;
}

export function writeStoredGenerationModelId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GENERATION_MODEL_STORAGE_KEY, id);
  } catch {
    // ignore storage errors
  }
}

export function getAutoGeminiModels() {
  return AUTO_GEMINI_MODELS;
}

export function getOpenRouterFallbackModel() {
  return getGenerationModelById(OPENROUTER_FALLBACK_MODEL_ID);
}
