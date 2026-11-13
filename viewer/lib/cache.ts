import { getCache } from "@vercel/functions";

/**
 * Small typed wrapper over Vercel's Runtime Cache. Outside Vercel the same API
 * is backed by an in-memory store. A cache failure is never an error: callers
 * fall back to fetching from GitHub.
 */
function store() {
  return getCache({ namespace: "gist-artifacts" });
}

export const MINUTE = 60;
export const DAY = 24 * 60 * 60;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return ((await store().get(key)) as T | null | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await store().set(key, value, { ttl: ttlSeconds });
  } catch {
    // Best effort.
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await store().delete(key);
  } catch {
    // Best effort.
  }
}
