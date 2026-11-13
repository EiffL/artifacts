import "server-only";

import { dangerouslyDeleteByTag } from "@vercel/functions";

import { cacheGet, cacheSet, DAY } from "./cache";
import { refreshHead } from "./gist-source";

/**
 * Makes the current revision of a Gist visible immediately: re-reads it from
 * GitHub and drops the CDN's cached current-revision responses.
 *
 * The purge runs at most once per revision, so repeated or hostile calls
 * cannot be used to keep emptying the cache.
 */
export async function revalidateGist(
  id: string,
): Promise<{ revision: string | null; changed: boolean }> {
  const { revision, changed } = await refreshHead(id);
  if (!revision) return { revision: null, changed: false };

  const marker = `purged:${id}`;
  if ((await cacheGet<string>(marker)) !== revision) {
    try {
      // Delete rather than invalidate: the very next view must show the new revision.
      await dangerouslyDeleteByTag(`gist-${id}`);
    } catch {
      // No CDN in front (local development): nothing to purge.
    }
    await cacheSet(marker, revision, DAY);
  }
  return { revision, changed };
}
