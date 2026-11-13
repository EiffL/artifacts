/**
 * Resolves and reads Gist content without the GitHub REST API.
 *
 * Serving a file needs three facts, none of which costs API quota:
 *   1. the Gist's owner     - from the redirect of gist.github.com/<id>
 *   2. the current revision - from Git's smart-HTTP ref advertisement
 *   3. the file bytes       - from the raw host, pinned to a commit SHA
 *
 * Raw files are always fetched by commit SHA, so every file of one page load
 * comes from the same revision and upstream caching can never serve stale data.
 */

import { cacheGet, cacheSet, DAY } from "./cache";
import { githubFetch } from "./github";
import { MANIFEST_FILE, parseManifest, type ManifestResult } from "./manifest";

const USER_AGENT = "gist-artifacts-viewer";

/** How long the current revision of a Gist is remembered before asking GitHub again. */
export const HEAD_TTL_SECONDS = 30;

function headKey(id: string) {
  return `head:${id}`;
}

async function ownerFromRedirect(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://gist.github.com/${id}`, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT },
      cache: "no-store",
    });
    const location = res.headers.get("location");
    if (!location) return null;
    const match = new URL(location, "https://gist.github.com").pathname.match(
      /^\/([^/]+)\/([0-9a-f]+)\/?$/,
    );
    return match && match[2] === id ? match[1] : null;
  } catch {
    return null;
  }
}

async function ownerFromApi(id: string): Promise<string | null> {
  try {
    const res = await githubFetch(`/gists/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { owner?: { login?: string } | null };
    return data.owner?.login ?? null;
  } catch {
    return null;
  }
}

/** Login of the Gist's owner, or null when the Gist does not exist. */
export async function resolveOwner(id: string): Promise<string | null> {
  const key = `owner:${id}`;
  const cached = await cacheGet<string>(key);
  if (cached) return cached;
  const owner = (await ownerFromRedirect(id)) ?? (await ownerFromApi(id));
  if (owner) await cacheSet(key, owner, 30 * DAY);
  return owner;
}

/** Extracts the HEAD commit from a smart-HTTP `info/refs` advertisement. */
export function parseHeadFromRefs(advertisement: string): string | null {
  return advertisement.match(/([0-9a-f]{40}) HEAD/)?.[1] ?? null;
}

/** Current revision straight from GitHub, bypassing the cache. */
export async function fetchHead(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://gist.github.com/${id}.git/info/refs?service=git-upload-pack`, {
      headers: { "user-agent": USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseHeadFromRefs(await res.text());
  } catch {
    return null;
  }
}

/** Current revision (commit SHA) of a Gist, or null when it does not exist. */
export async function resolveHead(id: string): Promise<string | null> {
  const cached = await cacheGet<string>(headKey(id));
  if (cached) return cached;
  const head = await fetchHead(id);
  if (head) await cacheSet(headKey(id), head, HEAD_TTL_SECONDS);
  return head;
}

/**
 * Re-reads the current revision and reports whether it differs from the cached one.
 * Used by the revalidation endpoint after a publish.
 */
export async function refreshHead(
  id: string,
): Promise<{ revision: string | null; changed: boolean }> {
  const previous = await cacheGet<string>(headKey(id));
  const revision = await fetchHead(id);
  if (!revision) return { revision: null, changed: false };
  await cacheSet(headKey(id), revision, HEAD_TTL_SECONDS);
  return { revision, changed: previous !== revision };
}

export function rawFileUrl(owner: string, id: string, sha: string, file: string): string {
  return `https://gist.githubusercontent.com/${encodeURIComponent(owner)}/${id}/raw/${sha}/${encodeURIComponent(file)}`;
}

/** Fetches one file at one revision from the raw host. The caller checks the status. */
export function fetchRaw(
  owner: string,
  id: string,
  sha: string,
  file: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(rawFileUrl(owner, id, sha, file), {
    headers: { "user-agent": USER_AGENT, "accept-encoding": "identity", ...headers },
    cache: "no-store",
  });
}

/** Manifest of a Gist at a revision. A revision is immutable, so this caches for a long time. */
export async function loadManifest(owner: string, id: string, sha: string): Promise<ManifestResult> {
  const key = `manifest:${id}:${sha}`;
  const cached = await cacheGet<ManifestResult>(key);
  if (cached) return cached;

  const res = await fetchRaw(owner, id, sha, MANIFEST_FILE);
  let result: ManifestResult;
  if (res.status === 404) {
    result = { manifest: null, problems: [`${MANIFEST_FILE} is missing`] };
  } else if (!res.ok) {
    // Transient upstream failure: report it but do not cache it.
    return { manifest: null, problems: [`could not read ${MANIFEST_FILE} (HTTP ${res.status})`] };
  } else {
    result = parseManifest(await res.text());
  }
  await cacheSet(key, result, 30 * DAY);
  return result;
}
