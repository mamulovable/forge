import { getWorkspaceUser, getWorkspaceById } from "@/actions/workspace";
import { PreviewPageClient } from "@/components/PreviewPageClient";
import type { FileData } from "@/types/workspace";

interface PreviewPageProps {
  searchParams: Promise<{ workspaceId?: string }>;
}

function parseFileData(raw: unknown): FileData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!data.files || !data.dependencies) return null;
  return raw as FileData;
}

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const { workspaceId } = await searchParams;

  if (workspaceId) {
    const user = await getWorkspaceUser();
    const workspace = await getWorkspaceById(workspaceId, user.id);
    const fileData = parseFileData(workspace.fileData);

    return (
      <PreviewPageClient
        initialFileData={fileData}
        title={workspace.title}
        workspaceId={workspace.id}
      />
    );
  }

  return <PreviewPageClient initialFileData={null} />;
}
