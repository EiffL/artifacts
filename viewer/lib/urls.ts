import { rootDomain } from "./config";

type HeaderSource = { get(name: string): string | null };

/** Origin the current request was addressed to, e.g. `https://viewer.example`. */
export function requestOrigin(headers: HeaderSource): string {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const bareHost = host.replace(/:\d+$/, "");
  const local = bareHost === "localhost" || bareHost.endsWith(".localhost") || bareHost === "127.0.0.1";
  return `${forwardedProto ?? (local ? "http" : "https")}://${host}`;
}

/**
 * Origin of the application itself (framed view, dashboard). In subdomain mode
 * that is the root domain even when the request arrived on an artifact subdomain.
 */
export function appOrigin(headers: HeaderSource): string {
  const origin = requestOrigin(headers);
  const root = rootDomain();
  if (!root) return origin;
  return `${origin.split("://")[0]}://${root}`;
}

/** Base URL of an artifact's files (always ends with a slash). */
export function artifactBase(id: string, app: string): string {
  const root = rootDomain();
  if (root) return `${app.split("://")[0]}://${id}.${root}/`;
  return `${app}/a/${id}/`;
}

export function artifactUrl(
  id: string,
  app: string,
  options: { rev?: string | null; file?: string | null } = {},
): string {
  let url = artifactBase(id, app);
  if (options.rev) url += `@${options.rev}/`;
  if (options.file) url += encodeURIComponent(options.file);
  return url;
}

/** URL of the framed view, the link meant to be shared with people. */
export function framedUrl(id: string, app: string, rev?: string | null): string {
  return `${app}/g/${id}${rev ? `?rev=${rev}` : ""}`;
}

export function gistUrl(id: string, owner?: string | null): string {
  return owner ? `https://gist.github.com/${owner}/${id}` : `https://gist.github.com/${id}`;
}
