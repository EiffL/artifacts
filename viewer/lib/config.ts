/**
 * Shared, dependency-free configuration helpers. Imported by both the request
 * proxy and the application, so keep this file free of server-only imports.
 */

/** Gist IDs are 32 hex characters today; older Gists have shorter hex or numeric IDs. */
export const GIST_ID_PATTERN = "[0-9a-f]{7,40}";
export const SHA_PATTERN = "[0-9a-f]{40}";

const GIST_ID_RE = new RegExp(`^${GIST_ID_PATTERN}$`);
const SHA_RE = new RegExp(`^${SHA_PATTERN}$`);

export function isGistId(value: unknown): value is string {
  return typeof value === "string" && GIST_ID_RE.test(value);
}

export function isSha(value: unknown): value is string {
  return typeof value === "string" && SHA_RE.test(value);
}

/**
 * Host (with optional port) under which `<gist-id>.<root>` resolves to this
 * application, for example `viewer.example` or `localhost:3000`.
 *
 * When set, every artifact is served from its own origin (subdomain mode).
 * When unset, artifacts are served from `/a/<gist-id>/` on the application
 * origin inside a CSP sandbox (path mode).
 */
export function rootDomain(): string | null {
  const value = process.env.ARTIFACTS_ROOT_DOMAIN?.trim().toLowerCase();
  if (!value) return null;
  return value.replace(/^https?:\/\//, "").replace(/\/+$/, "") || null;
}

/** Returns the Gist ID when `host` is an artifact subdomain, otherwise null. */
export function gistIdFromHost(host: string | null | undefined): string | null {
  const root = rootDomain();
  if (!root || !host) return null;
  const lower = host.toLowerCase();
  if (!lower.endsWith(`.${root}`)) return null;
  const label = lower.slice(0, -(root.length + 1));
  return isGistId(label) ? label : null;
}

/** True when `host` is some subdomain of the root domain (artifact or not). */
export function isSubdomainOfRoot(host: string | null | undefined): boolean {
  const root = rootDomain();
  if (!root || !host) return false;
  return host.toLowerCase().endsWith(`.${root}`);
}

/**
 * Extracts a Gist ID from user input: a bare ID, a gist.github.com URL, a raw
 * URL, or one of this viewer's own URLs.
 */
export function parseGistReference(input: string): string | null {
  const text = input.trim();
  if (isGistId(text.toLowerCase())) return text.toLowerCase();
  const matches = text.toLowerCase().match(/[0-9a-f]{7,40}/g);
  if (!matches) return null;
  // Prefer a 32-character ID; a URL may also contain a 40-character revision.
  return matches.find((m) => m.length === 32) ?? matches.find((m) => m.length !== 40) ?? null;
}
