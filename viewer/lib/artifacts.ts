import "server-only";

import { cacheGet, cacheSet, DAY, MINUTE } from "./cache";
import { loadManifest, resolveHead, resolveOwner } from "./gist-source";
import { getGist, listGists, type GistDetail, type GistSummary } from "./github";
import { MANIFEST_FILE, parseManifest, type Manifest } from "./manifest";

/** One row of the dashboard. Plain data, safe to pass to client components. */
export type ArtifactSummary = {
  id: string;
  title: string;
  description: string | null;
  mediaType: string | null;
  icon: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  commentCount: number;
  owner: string | null;
  htmlUrl: string;
};

const RAW_HOST = "gist.githubusercontent.com";
/** Manifests are read for at most this many Gists per listing; the rest use the Gist description. */
const MAX_MANIFEST_READS = 200;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index], index);
      }
    }),
  );
  return results;
}

/** Reads a manifest through its content-addressed raw URL, so the result never goes stale. */
async function manifestAt(rawUrl: string): Promise<Manifest | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.hostname !== RAW_HOST) return null;

  const key = `manifest-url:${url.pathname}`;
  const cached = await cacheGet<{ manifest: Manifest | null }>(key);
  if (cached) return cached.manifest;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const { manifest } = parseManifest(await res.text());
    await cacheSet(key, { manifest }, 30 * DAY);
    return manifest;
  } catch {
    return null;
  }
}

function summarize(gist: GistSummary, manifest: Manifest | null): ArtifactSummary {
  return {
    id: gist.id,
    title: manifest?.title ?? (gist.description?.trim() || "Untitled artifact"),
    description: manifest?.description ?? null,
    mediaType: manifest?.mediaType ?? null,
    icon: manifest?.icon ?? null,
    isPublic: gist.public,
    createdAt: gist.created_at,
    updatedAt: gist.updated_at,
    fileCount: Object.keys(gist.files).length,
    commentCount: gist.comments,
    owner: gist.owner?.login ?? null,
    htmlUrl: gist.html_url,
  };
}

export type ArtifactListing = {
  artifacts: ArtifactSummary[];
  /** Number of Gists looked at, artifact or not. */
  scanned: number;
  /** True when the account has more Gists than were scanned. */
  truncated: boolean;
};

/** A person's own or starred Gists that are artifacts, newest first. */
export async function listArtifacts(token: string, kind: "mine" | "starred"): Promise<ArtifactListing> {
  const { gists, truncated } = await listGists(token, kind);
  const candidates = gists.filter((gist) => MANIFEST_FILE in gist.files);
  const manifests = await mapLimit(candidates, 12, (gist, index) =>
    index < MAX_MANIFEST_READS ? manifestAt(gist.files[MANIFEST_FILE].raw_url) : Promise.resolve(null),
  );
  const artifacts = candidates
    .map((gist, index) => summarize(gist, manifests[index]))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { artifacts, scanned: gists.length, truncated };
}

export type ArtifactFile = { name: string; size: number; type: string };
export type ArtifactRevision = { version: string; committedAt: string };

/** Everything the framed view shows about one artifact. Plain data. */
export type ArtifactView = {
  id: string;
  owner: string;
  ownerAvatarUrl: string | null;
  title: string;
  description: string | null;
  manifest: Manifest | null;
  /** Deviations from the specification at the shown revision. */
  problems: string[];
  isPublic: boolean | null;
  updatedAt: string | null;
  /** Revision being displayed. */
  revision: string;
  /** Current revision of the Gist. */
  head: string;
  history: ArtifactRevision[];
  files: ArtifactFile[];
  commentCount: number | null;
  forkOf: { id: string; owner: string | null } | null;
  /** False when GitHub's API was unavailable and only the essentials could be loaded. */
  complete: boolean;
};

/**
 * Gist metadata from the REST API, cached per revision. The comment count is
 * the only field that changes without a new revision, hence the short lifetime.
 */
async function gistDetail(id: string, head: string, token?: string | null): Promise<GistDetail | null> {
  const key = `detail:${id}:${head}`;
  const cached = await cacheGet<GistDetail>(key);
  if (cached) return cached;
  try {
    const detail = await getGist(id, { token });
    if (!detail) return null;
    // Inline file contents can be large and are not needed again.
    const files = Object.fromEntries(
      Object.entries(detail.files).map(([name, file]) => [name, { ...file, content: undefined }]),
    );
    const slim = { ...detail, files };
    await cacheSet(key, slim, 10 * MINUTE);
    return slim;
  } catch {
    return null;
  }
}

export async function loadArtifactView(
  id: string,
  rev: string | null,
  token?: string | null,
): Promise<ArtifactView | null> {
  const owner = await resolveOwner(id);
  const head = owner ? await resolveHead(id) : null;
  if (!owner || !head) return null;

  const revision = rev ?? head;
  const [{ manifest, problems }, detail] = await Promise.all([
    loadManifest(owner, id, revision),
    gistDetail(id, head, token),
  ]);

  return {
    id,
    owner,
    ownerAvatarUrl: detail?.owner?.avatar_url ?? null,
    title: manifest?.title ?? (detail?.description?.trim() || "Untitled artifact"),
    description: manifest?.description ?? null,
    manifest,
    problems,
    isPublic: detail ? detail.public : null,
    updatedAt: detail?.updated_at ?? null,
    revision,
    head,
    history: (detail?.history ?? []).map((entry) => ({
      version: entry.version,
      committedAt: entry.committed_at,
    })),
    files: Object.values(detail?.files ?? {}).map((file) => ({
      name: file.filename,
      size: file.size,
      type: file.type,
    })),
    commentCount: detail ? detail.comments : null,
    forkOf: detail?.fork_of ? { id: detail.fork_of.id, owner: detail.fork_of.owner?.login ?? null } : null,
    complete: detail !== null,
  };
}
