import LZString from "lz-string";

const TEMPLATE = "create-react-app-typescript";
const DEFINE_API_URL =
  "https://codesandbox.io/api/v1/sandboxes/define?json=1";

const TAILWIND_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

type CodeSandboxFile = {
  content: string;
  isBinary: false;
};

function normalizeFilePath(path: string): string {
  let normalized = path.startsWith("/") ? path.slice(1) : path;
  if (normalized.startsWith("src/")) {
    normalized = normalized.slice(4);
  }
  return normalized;
}

function compressParameters(payload: {
  files: Record<string, CodeSandboxFile>;
  template: string;
}): string {
  return LZString.compressToBase64(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function prepareCodeSandboxFiles(
  files: Record<string, string>
): Record<string, CodeSandboxFile> {
  const prepared: Record<string, CodeSandboxFile> = {};

  for (const [path, content] of Object.entries(files)) {
    prepared[normalizeFilePath(path)] = { content, isBinary: false };
  }

  prepared["public/index.html"] = {
    content: TAILWIND_INDEX_HTML,
    isBinary: false,
  };

  return prepared;
}

export async function openInCodeSandbox(
  files: Record<string, string>
): Promise<void> {
  const parameters = compressParameters({
    files: prepareCodeSandboxFiles(files),
    template: TEMPLATE,
  });

  const response = await fetch(DEFINE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ parameters }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `CodeSandbox API returned ${response.status}: ${message || response.statusText}`
    );
  }

  const data = (await response.json()) as { sandbox_id?: string };

  if (!data.sandbox_id) {
    throw new Error("CodeSandbox did not return a sandbox_id");
  }

  window.open(
    `https://${data.sandbox_id}.csb.app/`,
    "_blank",
    "noopener,noreferrer"
  );
}
