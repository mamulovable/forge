"use server";

import { redirect } from "next/navigation";import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import type { WorkspaceUser, WorkspaceData } from "@/types/workspace";

export type { WorkspaceUser, WorkspaceData } from "@/types/workspace";

// ─── Get the current authenticated user ──────────────────────────────────────

export async function getWorkspaceUser(): Promise<WorkspaceUser> {
  const user = await checkUser();
  if (!user) redirect("/");

  return {
    id: user.id,
    credits: user.credits,
    plan: user.plan,
  };
}

// ─── Get a workspace by id (must belong to the current user) ─────────────────

export async function getWorkspaceById(
  workspaceId: string,
  userId: string
): Promise<WorkspaceData> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId, userId },
    select: {
      id: true,
      title: true,
      messages: true,
      fileData: true,
    },
  });

  if (!workspace) redirect("/");

  return workspace;
}
