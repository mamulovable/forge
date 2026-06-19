import type { FileData } from "@/types/workspace";

export const PREVIEW_STORAGE_KEY = "forge-preview-snapshot";

export function writePreviewSnapshot(data: FileData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function readPreviewSnapshot(): FileData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FileData;
    if (!parsed?.files || !parsed?.dependencies) return null;
    return parsed;
  } catch {
    return null;
  }
}
