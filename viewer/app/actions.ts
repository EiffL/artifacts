"use server";

import { isGistId } from "@/lib/config";
import {
  GitHubError,
  createComment,
  deleteGist,
  forkGist,
  getGist,
  listComments,
  setStar,
  updateGist,
} from "@/lib/github";
import { MANIFEST_FILE } from "@/lib/manifest";
import { revalidateGist } from "@/lib/revalidate";
import { getSession, toViewer, type Session } from "@/lib/session";

/**
 * Every action re-reads the session and talks to GitHub with the signed-in
 * person's own token. GitHub is the authority on what they may do.
 */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export type CommentView = {
  id: number;
  body: string;
  createdAt: string;
  author: string | null;
  authorAvatarUrl: string | null;
};

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof GitHubError) {
    if (error.status === 401) return { ok: false, error: "Your GitHub session expired. Sign in again." };
    if (error.rateLimited) return { ok: false, error: "GitHub rate limit reached. Try again in a few minutes." };
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong talking to GitHub." };
}

async function writer(id: string): Promise<{ session: Session } | { error: string }> {
  if (!isGistId(id)) return { error: "Invalid Gist ID." };
  const session = await getSession();
  if (!session) return { error: "Sign in with GitHub first." };
  if (!toViewer(session).canWrite) {
    return { error: "This needs the gist permission. Sign in again and grant it." };
  }
  return { session };
}

export async function starArtifact(id: string, starred: boolean): Promise<ActionResult> {
  const auth = await writer(id);
  if ("error" in auth) return { ok: false, error: auth.error };
  try {
    await setStar(id, auth.session.token, starred);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function forkArtifact(id: string): Promise<ActionResult<{ id: string }>> {
  const auth = await writer(id);
  if ("error" in auth) return { ok: false, error: auth.error };
  try {
    const fork = await forkGist(id, auth.session.token);
    return { ok: true, data: { id: fork.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteArtifact(id: string): Promise<ActionResult> {
  const auth = await writer(id);
  if ("error" in auth) return { ok: false, error: auth.error };
  try {
    await deleteGist(id, auth.session.token);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function updateArtifactDetails(
  id: string,
  input: { title: string; description: string },
): Promise<ActionResult> {
  const auth = await writer(id);
  if ("error" in auth) return { ok: false, error: auth.error };
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) return { ok: false, error: "A title is required." };
  try {
    const gist = await getGist(id, { token: auth.session.token });
    const file = gist?.files[MANIFEST_FILE];
    if (!gist || !file?.content || file.truncated) {
      return { ok: false, error: `This Gist has no readable ${MANIFEST_FILE}.` };
    }
    const manifest = JSON.parse(file.content) as Record<string, unknown>;
    manifest.title = title;
    if (description) manifest.description = description;
    else delete manifest.description;
    // One PATCH is one revision: the manifest and the Gist description change together.
    await updateGist(id, auth.session.token, {
      description: title,
      files: { [MANIFEST_FILE]: { content: `${JSON.stringify(manifest, null, 2)}\n` } },
    });
    await revalidateGist(id);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

function toCommentView(comment: Awaited<ReturnType<typeof listComments>>[number]): CommentView {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.created_at,
    author: comment.user?.login ?? null,
    authorAvatarUrl: comment.user?.avatar_url ?? null,
  };
}

export async function loadComments(id: string): Promise<ActionResult<CommentView[]>> {
  if (!isGistId(id)) return { ok: false, error: "Invalid Gist ID." };
  try {
    const session = await getSession();
    const comments = await listComments(id, session?.token);
    return { ok: true, data: comments.map(toCommentView) };
  } catch (error) {
    return failure(error);
  }
}

export async function commentOnArtifact(id: string, body: string): Promise<ActionResult<CommentView>> {
  const auth = await writer(id);
  if ("error" in auth) return { ok: false, error: auth.error };
  const text = body.trim();
  if (!text) return { ok: false, error: "Write a comment first." };
  try {
    return { ok: true, data: toCommentView(await createComment(id, auth.session.token, text)) };
  } catch (error) {
    return failure(error);
  }
}
