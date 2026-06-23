// CodePanel.tsx
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { dracula } from "@codesandbox/sandpack-themes";
import {
  Eye,
  Code2,
  Download,
  AlertTriangle,
  Bot,
  Loader2,
  ArrowUp,
  ExternalLink,
} from "lucide-react";
import { RingLoader } from "react-spinners";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingModal } from "@/components/PricingModal";
import { cn } from "@/lib/utils";
import { openInCodeSandbox } from "@/lib/open-in-codesandbox";
import { BASE_DEPENDENCIES } from "@/lib/sandpack-setup";
import { toast } from "sonner";
import type { FileData, StatusStep } from "@/types/workspace";

// ─── Placeholder ──────────────────────────────────────────────────────────────

const PLACEHOLDER_FILES = {
  "/App.js": {
    code: `export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
        <p style={{ fontSize: 14 }}>Your app will appear here</p>
      </div>
    </div>
  );
}`,
  },
};

// ─── Base dependencies ────────────────────────────────────────────────────────
// Re-exported from lib/sandpack-setup for ZIP export compatibility.

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = "preview" | "code";

export interface CodePanelHandle {
  openPreviewInNewTab: () => Promise<void>;
}

interface CodePanelProps {
  fileData: FileData | null;
  isGenerating: boolean;
  statusLog: StatusStep[];
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  onFilePatch: (patches: FileData) => void;
  appTitle: string | null;
  isImproving: boolean;
  isProUser: boolean;
  workspaceId: string | null;
}
// Lives inside SandpackProvider so it can call useSandpack().
// Receives fileData as a prop and uses updateFile() to push code changes
// into the live Sandpack instance without remounting the provider.

function SandpackInner({
  isGenerating,
  statusLog,
  activeTab,
  setActiveTab,
  onImprove,
  onFixError,
  fileData,
  appTitle,
  isImproving,
  isProUser,
  openPreviewRef,
}: {
  isGenerating: boolean;
  statusLog: StatusStep[];
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  fileData: FileData | null;
  appTitle: string | null;
  isImproving: boolean;
  isProUser: boolean;
  openPreviewRef: React.MutableRefObject<(() => Promise<void>) | null>;
}) {
  const { sandpack, listen } = useSandpack();
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);
  const [improveInput, setImproveInput] = useState("");
  const [showImproveInput, setShowImproveInput] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Push file content updates into Sandpack without remounting.
  // This runs whenever fileData changes (e.g. after improve completes).
  // SandpackProvider key only changes when the file path set changes,
  // so this is the safe way to update existing file contents.
  const prevFilesRef = useRef<Record<string, { code: string }>>({});
  useEffect(() => {
    if (!fileData?.files) return;
    const prev = prevFilesRef.current;
    for (const [path, { code }] of Object.entries(fileData.files)) {
      if (prev[path]?.code !== code) {
        sandpack.updateFile(path, code);
      }
    }
    prevFilesRef.current = fileData.files;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData?.files]);

  // Listen for Sandpack runtime errors
  useEffect(() => {
    unsubscribeRef.current = listen((msg) => {
      if (
        msg.type === "action" &&
        "action" in msg &&
        msg.action === "show-error"
      ) {
        const errMsg =
          "message" in msg && typeof msg.message === "string"
            ? msg.message
            : "An error occurred in the preview.";
        setPreviewError(errMsg);
        return;
      }
      if (msg.type === "compile") {
        const errMsg =
          "message" in msg && typeof msg.message === "string"
            ? msg.message
            : "Compile error in preview.";
        setPreviewError(errMsg);
        return;
      }
      if (msg.type === "success") {
        setPreviewError(null);
      }
    });
    return () => unsubscribeRef.current?.();
  }, [listen]);

  useEffect(() => {
    if (isGenerating) setPreviewError(null);
  }, [isGenerating]);

  const handleImproveSubmit = async () => {
    const trimmed = improveInput.trim();
    if (!trimmed || isImproving) return;
    setImproveInput("");
    setShowImproveInput(false);
    await onImprove(trimmed);
  };

  const improveInputRow = (
    <div className="flex items-center gap-1.5">
      <div className="relative flex min-w-0 flex-1 items-center">
        <Bot className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-violet-400" />
        <input
          autoFocus
          value={improveInput}
          onChange={(e) => setImproveInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleImproveSubmit();
            if (e.key === "Escape") setShowImproveInput(false);
          }}
          placeholder="What should I improve?"
          className="h-7 w-full min-w-0 rounded-md border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 pl-8 pr-3 text-xs text-white/80 placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none focus:shadow-[0_0_10px_rgba(139,92,246,0.2)] lg:w-56 lg:flex-none"
        />
      </div>
      <button
        onClick={handleImproveSubmit}
        disabled={!improveInput.trim() || isImproving}
        className="group relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-300 transition-all duration-200 hover:border-violet-400/50 hover:from-violet-500/30 hover:to-fuchsia-500/30 hover:shadow-[0_0_10px_rgba(139,92,246,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isImproving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        )}
      </button>
    </div>
  );

  const renderImproveAgent = (compact = false) => {
    if (showImproveInput) {
      return compact ? null : improveInputRow;
    }

    const buttonClassName = compact
      ? "group relative flex h-7 shrink-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md border border-white/10 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 px-2 text-[11px] font-medium transition-all duration-300 hover:border-white/20 hover:from-violet-500/20 hover:via-fuchsia-500/20 hover:to-cyan-500/20 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
      : "group relative flex h-7 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md border border-white/10 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 px-2.5 text-xs font-medium transition-all duration-300 hover:border-white/20 hover:from-violet-500/20 hover:via-fuchsia-500/20 hover:to-cyan-500/20 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] disabled:cursor-not-allowed disabled:opacity-40";

    const label = isImproving ? "Improving…" : compact ? "Improve" : "Improve with Agent";

    if (isProUser) {
      return (
        <button
          onClick={() => setShowImproveInput(true)}
          disabled={isImproving || !fileData}
          className={buttonClassName}
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          {isImproving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
          ) : (
            <Bot className="h-3.5 w-3.5 text-violet-400 transition-colors group-hover:text-violet-300" />
          )}
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            {label}
          </span>
          {!isImproving && (
            <span className="rounded-sm bg-violet-500/30 px-1 py-0.5 text-[10px] font-semibold leading-none text-violet-300">
              PRO
            </span>
          )}
        </button>
      );
    }

    return (
      <PricingModal reason="upgrade">
        <span
          className={cn(
            buttonClassName,
            "text-white/60 hover:text-white/90"
          )}
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <Bot className="h-3.5 w-3.5 text-violet-400 transition-colors group-hover:text-violet-300" />
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            {compact ? "Improve" : "Improve with Agent"}
          </span>
          <span className="rounded-sm bg-violet-500/30 px-1 py-0.5 text-[10px] font-semibold leading-none text-violet-300">
            PRO
          </span>
        </span>
      </PricingModal>
    );
  };

  // ── Export to ZIP ──────────────────────────────────────────────────────────
  const handleExportZip = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const filesToZip =
        Object.keys(sandpack.files).length > 0
          ? sandpack.files
          : fileData?.files ?? {};

      const dependencies = {
        ...BASE_DEPENDENCIES,
        ...(fileData?.dependencies ?? {}),
      };

      const zip = new JSZip();

      const packageJson = {
        name: "forge-app",
        version: "1.0.0",
        private: true,
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "react-scripts": "5.0.1",
          ...dependencies,
        },
        scripts: {
          start: "react-scripts start",
          build: "react-scripts build",
        },
        browserslist: {
          production: [">0.2%", "not dead", "not op_mini all"],
          development: ["last 1 chrome version"],
        },
      };
      zip.file("package.json", JSON.stringify(packageJson, null, 2));

      zip.file(
        "public/index.html",
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dreamera App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
      );

      for (const [filePath, fileObj] of Object.entries(filesToZip)) {
        const code =
          typeof fileObj === "object" && fileObj !== null && "code" in fileObj
            ? (fileObj as { code: string }).code
            : "";
        const zipPath = filePath.startsWith("/")
          ? `src${filePath}`
          : `src/${filePath}`;
        zip.file(zipPath, code);
      }

      zip.file(
        "src/index.js",
        `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);`
      );

      zip.file(
        "README.md",
        `# Dreamera App\n\nGenerated with [Dreamera](https://dreamera.app).\n\n## Getting started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\``
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const zipName = appTitle
        ? `${appTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}.zip`
        : "dreamera-app.zip";
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenPreviewTab = useCallback(async () => {
    if (!fileData || isOpeningPreview) return;

    const filesToPreview =
      Object.keys(sandpack.files).length > 0
        ? sandpack.files
        : fileData.files;

    const files: Record<string, string> = {};
    for (const [path, fileObj] of Object.entries(filesToPreview)) {
      files[path] =
        typeof fileObj === "object" && fileObj !== null && "code" in fileObj
          ? (fileObj as { code: string }).code
          : "";
    }

    setIsOpeningPreview(true);
    try {
      await openInCodeSandbox(files);
    } catch (err) {
      console.error("Failed to open CodeSandbox preview:", err);
      toast.error("Could not open preview", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setIsOpeningPreview(false);
    }
  }, [fileData, isOpeningPreview, sandpack.files]);

  useEffect(() => {
    openPreviewRef.current = handleOpenPreviewTab;
  }, [handleOpenPreviewTab, openPreviewRef]);

  const currentStepLabel =
    statusLog[statusLog.length - 1]?.label ?? "Generating…";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as ActiveTab)}
      className="flex h-full min-h-0 w-full flex-1 flex-col gap-0"
    >
      {/* Tabs + Actions bar */}
      <div className="flex shrink-0 flex-col border-b border-white/6">
        <div className="flex items-center justify-between gap-1 px-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <TabsList
              variant="line"
              className="h-auto shrink-0 gap-0 rounded-none bg-transparent p-0"
            >
              <TabsTrigger className="border-b-2 pt-2" value="code">
                <Code2 className="h-3.5 w-3.5" />
                Code
              </TabsTrigger>
              <TabsTrigger className="border-b-2 pt-2" value="preview">
                <Eye className="h-3.5 w-3.5" />
                Preview
              </TabsTrigger>
            </TabsList>

            <div className="shrink-0 lg:hidden">{renderImproveAgent(true)}</div>
          </div>

          <div className="hidden items-center gap-1.5 lg:flex">
            {showImproveInput ? improveInputRow : renderImproveAgent()}

            <Button
              variant="ghost"
              onClick={handleOpenPreviewTab}
              disabled={
                !fileData || isGenerating || isImproving || isOpeningPreview
              }
              title="Open preview in new tab"
            >
              {isOpeningPreview ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Preview
            </Button>

            <Button
              onClick={handleExportZip}
              disabled={isExporting || !fileData}
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download
            </Button>
          </div>

          <Button
            variant="ghost"
            className="shrink-0 lg:hidden"
            onClick={handleOpenPreviewTab}
            disabled={
              !fileData || isGenerating || isImproving || isOpeningPreview
            }
            title="Open preview in new tab"
          >
            {isOpeningPreview ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            Open
          </Button>
        </div>

        {showImproveInput && (
          <div className="border-t border-white/6 px-2 py-1.5 lg:hidden">
            {improveInputRow}
          </div>
        )}
      </div>

      {/* Content area — must flex-1 so preview fills remaining height */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {(isGenerating || isImproving) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-[#0a0a0a]/85 backdrop-blur-sm">
            <RingLoader color="#60a5fa" size={64} speedMultiplier={0.8} />
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm font-medium text-white/60">
                {isImproving ? "Improving with Cline AI…" : currentStepLabel}
              </p>
              <p className="text-xs text-white/20">
                This usually takes 10–20 seconds
              </p>
            </div>
          </div>
        )}

        <SandpackPreview
          className={cn(
            "forge-sandpack-preview h-full w-full",
            activeTab !== "preview" && "hidden"
          )}
          showOpenInCodeSandbox={false}
        />

        <div
          className={cn(
            "forge-sandpack-code-tab h-full w-full",
            activeTab !== "code" && "hidden"
          )}
        >
          <SandpackFileExplorer
            style={{
              height: "100%",
              width: "180px",
              borderRight: "0.5px solid rgba(255,255,255,0.08)",
            }}
          />
          <SandpackCodeEditor
            style={{ height: "100%", flex: 1 }}
            showTabs
            showLineNumbers
            showInlineErrors
            closableTabs
            readOnly
          />
        </div>
      </div>

      {/* Preview error banner — uses onFixError (Gemini), not onImprove (Cline) */}
      {previewError &&
        !isGenerating &&
        !isImproving &&
        activeTab === "preview" && (
          <div className="absolute inset-x-0 -bottom-3 z-20 border-t border-red-500/20 bg-red-950/99 p-4 pb-6">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400/70" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-red-400/80">
                  Preview error
                </p>
                <p className="break-all text-[11px] text-red-300/50">
                  {previewError}
                </p>
              </div>
              <Button
                onClick={() => onFixError(previewError)}
                variant="destructive"
              >
                <Bot className="h-3 w-3" />
                Fix with AI
              </Button>
            </div>
          </div>
        )}
    </Tabs>
  );
}

// ─── CodePanel (outer) ────────────────────────────────────────────────────────

export const CodePanel = forwardRef<CodePanelHandle, CodePanelProps>(
  function CodePanel(
    {
      fileData,
      isGenerating,
      statusLog,
      onImprove,
      onFixError,
      onFilePatch: _onFilePatch,
      appTitle,
      isImproving,
      isProUser,
      workspaceId: _workspaceId,
    },
    ref
  ) {
  const openPreviewRef = useRef<(() => Promise<void>) | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("preview");

  useImperativeHandle(ref, () => ({
    openPreviewInNewTab: async () => {
      await openPreviewRef.current?.();
    },
  }));

  useEffect(() => {
    if (fileData) setActiveTab("preview");
  }, [fileData]);

  const files = fileData?.files ?? PLACEHOLDER_FILES;
  const dependencies = {
    ...BASE_DEPENDENCIES,
    ...(fileData?.dependencies ?? {}),
  };

  // Key only on file path set — NOT on file contents.
  // Content changes go through sandpack.updateFile() inside SandpackInner.
  // This prevents Sandpack from remounting when only code changes.
  const filePathKey = Object.keys(files).sort().join("|");

  return (
    <div className="forge-sandpack-root flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <SandpackProvider
        key={filePathKey}
        template="react"
        theme={dracula}
        files={files}
        customSetup={{ dependencies }}
        options={{
          externalResources: ["https://cdn.tailwindcss.com"],
          recompileMode: "delayed",
          recompileDelay: 500,
        }}
        className="forge-sandpack-provider"
      >
        <SandpackInner
          isGenerating={isGenerating}
          statusLog={statusLog}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onImprove={onImprove}
          onFixError={onFixError}
          fileData={fileData}
          appTitle={appTitle}
          isImproving={isImproving}
          isProUser={isProUser}
          openPreviewRef={openPreviewRef}
        />
      </SandpackProvider>
    </div>
  );
});
