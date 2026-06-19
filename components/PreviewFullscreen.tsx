"use client";

import Link from "next/link";
import {
  SandpackProvider,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import { dracula } from "@codesandbox/sandpack-themes";
import { ArrowLeft, Zap } from "lucide-react";
import {
  BASE_DEPENDENCIES,
  SANDPACK_EXTERNAL_RESOURCES,
} from "@/lib/sandpack-setup";
import type { FileData } from "@/types/workspace";

interface PreviewFullscreenProps {
  fileData: FileData;
  title?: string | null;
  workspaceId?: string | null;
}

export function PreviewFullscreen({
  fileData,
  title,
  workspaceId,
}: PreviewFullscreenProps) {
  const dependencies = {
    ...BASE_DEPENDENCIES,
    ...fileData.dependencies,
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/8 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {workspaceId ? (
            <Link
              href={`/workspace?id=${workspaceId}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/6 hover:text-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Back to workspace</span>
            </Link>
          ) : (
            <Link
              href="/workspace"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/6 hover:text-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          )}
          <div className="hidden h-4 w-px bg-white/10 sm:block" />
          <div className="flex min-w-0 items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 shrink-0 text-[#FF6B2C]" />
            <p className="truncate text-sm font-medium text-white/80">
              {title || fileData.title || "App preview"}
            </p>
          </div>
        </div>
        <span className="text-[11px] text-white/30">Full preview</span>
      </header>

      <div className="forge-preview-fullscreen min-h-0 flex-1">
        <SandpackProvider
          template="react"
          theme={dracula}
          files={fileData.files}
          customSetup={{ dependencies }}
          options={{
            externalResources: SANDPACK_EXTERNAL_RESOURCES,
            recompileMode: "delayed",
            recompileDelay: 500,
          }}
          className="forge-sandpack-provider h-full"
        >
          <SandpackPreview
            className="forge-sandpack-preview h-full w-full"
            showOpenInCodeSandbox={false}
            showRefreshButton
          />
        </SandpackProvider>
      </div>
    </div>
  );
}
