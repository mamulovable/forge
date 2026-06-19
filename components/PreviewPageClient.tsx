"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readPreviewSnapshot } from "@/lib/preview-storage";
import { PreviewFullscreen } from "@/components/PreviewFullscreen";
import type { FileData } from "@/types/workspace";

interface PreviewPageClientProps {
  initialFileData: FileData | null;
  title?: string | null;
  workspaceId?: string | null;
}

function parseFileData(raw: unknown): FileData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!data.files || !data.dependencies) return null;
  return raw as FileData;
}

export function PreviewPageClient({
  initialFileData,
  title,
  workspaceId,
}: PreviewPageClientProps) {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const snapshot = readPreviewSnapshot();
    setFileData(snapshot ?? initialFileData);
    setReady(true);
  }, [initialFileData]);

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a] text-sm text-white/40">
        Loading preview…
      </div>
    );
  }

  const resolved = parseFileData(fileData);
  if (!resolved) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-[#0a0a0a] px-4 text-center">
        <p className="text-sm text-white/60">No preview available.</p>
        <p className="max-w-sm text-xs text-white/30">
          Generate an app in the workspace first, then use Open in new tab from
          the preview panel.
        </p>
        <Link
          href={workspaceId ? `/workspace?id=${workspaceId}` : "/workspace"}
          className="mt-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-white/90"
        >
          Go to workspace
        </Link>
      </div>
    );
  }

  return (
    <PreviewFullscreen
      fileData={resolved}
      title={title ?? resolved.title}
      workspaceId={workspaceId}
    />
  );
}
