/**
 * Serves the files of a Gist Artifact.
 *
 *   /a/<gist-id>/                  entrypoint, current revision
 *   /a/<gist-id>/<file>            any file, current revision
 *   /a/<gist-id>/@<sha>/           entrypoint, pinned revision
 *   /a/<gist-id>/@<sha>/<file>     any file, pinned revision
 *
 * In subdomain mode the request proxy rewrites `<gist-id>.<root>/<path>` to
 * this route, and each artifact runs in its own origin. In path mode the route
 * is reached directly on the application origin and every response carries a
 * CSP sandbox, which gives the artifact an opaque origin instead.
 */

import type { NextRequest } from "next/server";

import { gistIdFromHost, isGistId, isSha, rootDomain } from "@/lib/config";
import { fetchRaw, loadManifest, resolveHead, resolveOwner } from "@/lib/gist-source";
import { MANIFEST_FILE } from "@/lib/manifest";
import { bareMediaType, contentTypeFor } from "@/lib/mime";
import { errorPage, imagePage, markdownPage, textPage } from "@/lib/render";
import { appOrigin, artifactUrl } from "@/lib/urls";

type Context = { params: Promise<{ id: string; path?: string[] }> };

/** Applied only when artifacts share the application's origin (path mode). */
const SANDBOX =
  "sandbox allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock";

/** Seconds the CDN keeps a current-revision response before asking again. */
const CURRENT_TTL_SECONDS = 30;
const ONE_YEAR_SECONDS = 31536000;
/** Wrapper pages inline the entrypoint, so they refuse very large documents. */
const MAX_WRAPPED_BYTES = 5 * 1024 * 1024;

const HTML = "text/html; charset=utf-8";

function baseHeaders(isolated: boolean): Headers {
  const headers = new Headers({
    "access-control-allow-origin": "*",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    // Secret Gists are unlisted: keep them out of search engines and referrers.
    "x-robots-tag": "noindex",
    "referrer-policy": "no-referrer",
  });
  if (!isolated) headers.set("content-security-policy", SANDBOX);
  return headers;
}

function applyCaching(headers: Headers, id: string, pinned: boolean): void {
  if (pinned) {
    headers.set("cache-control", `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
    headers.set("vercel-cdn-cache-control", `max-age=${ONE_YEAR_SECONDS}`);
    return;
  }
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("vercel-cdn-cache-control", `max-age=${CURRENT_TTL_SECONDS}`);
  headers.set("vercel-cache-tag", `gist-${id}`);
}

export async function GET(request: NextRequest, context: Context): Promise<Response> {
  const params = await context.params;
  const id = params.id.toLowerCase();
  const hostId = gistIdFromHost(request.headers.get("host"));
  const isolated = hostId !== null;
  const app = appOrigin(request.headers);
  const headers = baseHeaders(isolated);

  const fail = (status: number, heading: string, detail: string): Response => {
    headers.set("content-type", HTML);
    headers.set("cache-control", "no-store");
    return new Response(errorPage(status, heading, detail, app), { status, headers });
  };

  if (!isGistId(id) || (hostId !== null && hostId !== id)) {
    return fail(404, "Not found", "This address does not point to a Gist.");
  }

  let segments = params.path ?? [];
  let rev: string | null = null;
  if (segments[0]?.startsWith("@")) {
    rev = segments[0].slice(1).toLowerCase();
    segments = segments.slice(1);
    if (!isSha(rev)) {
      return fail(400, "Invalid revision", "A pinned revision must be a full 40-character commit SHA.");
    }
  }
  if (segments.length > 1) {
    return fail(404, "File not found", "Gist files are flat: an artifact has no sub-directories.");
  }
  const file = segments[0] ?? null;

  // In subdomain mode the application origin never serves artifact content.
  if (!isolated && rootDomain()) {
    return Response.redirect(artifactUrl(id, app, { rev, file }), 308);
  }

  const owner = await resolveOwner(id);
  const sha = owner ? (rev ?? (await resolveHead(id))) : null;
  if (!owner || !sha) {
    return fail(404, "Gist not found", "No Gist with this ID exists, or it has been deleted.");
  }
  headers.set("x-gist-revision", sha);
  const pinned = rev !== null;

  let target = file;
  let viaManifest = false;
  if (target === null) {
    // Entrypoint request: the manifest decides what to show and how.
    const { manifest } = await loadManifest(owner, id, sha);
    viaManifest = manifest !== null;
    // A Gist without a manifest is not a conforming artifact, but an
    // `index.html` is still shown so plain HTML Gists keep working.
    const entry = manifest?.entrypoint ?? "index.html";
    const mediaType = manifest?.mediaType ?? bareMediaType(contentTypeFor(entry));
    const title = manifest?.title ?? entry;

    if (mediaType.startsWith("image/")) {
      headers.set("content-type", HTML);
      applyCaching(headers, id, pinned);
      return new Response(imagePage(title, encodeURIComponent(entry)), { headers });
    }

    const asText = mediaType === "application/json" || (mediaType.startsWith("text/") && mediaType !== "text/html");
    if (asText) {
      const source = await fetchRaw(owner, id, sha, entry);
      if (source.status === 404) {
        return fail(404, "Entrypoint not found", `The manifest names "${entry}", which is not in this Gist.`);
      }
      if (!source.ok) return fail(502, "GitHub is unavailable", `GitHub responded ${source.status}.`);
      const text = await source.text();
      if (text.length <= MAX_WRAPPED_BYTES) {
        const page =
          mediaType === "text/markdown"
            ? markdownPage(title, text)
            : textPage(title, text, mediaType === "application/json");
        headers.set("content-type", HTML);
        applyCaching(headers, id, pinned);
        return new Response(page, { headers });
      }
      // Too large to wrap: fall through and serve the file itself.
    }
    target = entry;
  }

  const forwarded: Record<string, string> = {};
  const range = request.headers.get("range");
  if (range) forwarded.range = range;
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) forwarded["if-none-match"] = ifNoneMatch;

  const upstream = await fetchRaw(owner, id, sha, target, forwarded);

  if (upstream.status === 404) {
    if (file === null && !viaManifest) {
      return fail(
        404,
        "Not an artifact",
        `This Gist has no ${MANIFEST_FILE} and no index.html, so there is nothing to display.`,
      );
    }
    return fail(404, "File not found", `"${target}" is not in this Gist at this revision.`);
  }

  const etag = upstream.headers.get("etag");
  if (etag) headers.set("etag", etag);

  if (upstream.status === 304) {
    applyCaching(headers, id, pinned);
    return new Response(null, { status: 304, headers });
  }
  if (upstream.status !== 200 && upstream.status !== 206) {
    return fail(502, "GitHub is unavailable", `GitHub responded ${upstream.status}.`);
  }

  headers.set("content-type", contentTypeFor(target));
  headers.set("accept-ranges", "bytes");
  if (!upstream.headers.get("content-encoding")) {
    const length = upstream.headers.get("content-length");
    if (length) headers.set("content-length", length);
  }
  if (upstream.status === 206) {
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("content-range", contentRange);
    headers.set("cache-control", "no-store");
  } else {
    applyCaching(headers, id, pinned);
  }

  // Streaming the body keeps large files clear of the function response size limit.
  return new Response(upstream.body, { status: upstream.status, headers });
}
