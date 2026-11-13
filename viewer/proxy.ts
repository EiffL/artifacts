import { NextResponse, type NextRequest } from "next/server";

import { GIST_ID_PATTERN, SHA_PATTERN, gistIdFromHost, isGistId, isSubdomainOfRoot } from "@/lib/config";

const PINNED_WITHOUT_SLASH = new RegExp(`^/@${SHA_PATTERN}$`);
const PATH_MODE_WITHOUT_SLASH = new RegExp(`^/a/${GIST_ID_PATTERN}(/@${SHA_PATTERN})?$`);
const FRAMED_VIEW = /^\/g\/([^/]+)\/?$/;

function addTrailingSlash(request: NextRequest): Response {
  // Built by hand: NextURL would normalise the trailing slash away again.
  const { origin, pathname, search } = request.nextUrl;
  return new Response(null, {
    status: 308,
    headers: { location: `${origin}${pathname}/${search}` },
  });
}

/**
 * Host routing.
 *
 * - `<gist-id>.<root>` (subdomain mode): every path is an artifact file, so the
 *   whole request is rewritten to the file route. Nothing else is reachable on
 *   an artifact origin: no pages, no API, no session.
 * - Application host: fixes up artifact base URLs that lack the trailing slash
 *   relative references depend on, and rejects malformed framed-view addresses.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const { pathname } = request.nextUrl;

  const gistId = gistIdFromHost(host);
  if (gistId) {
    if (PINNED_WITHOUT_SLASH.test(pathname)) return addTrailingSlash(request);
    const url = request.nextUrl.clone();
    url.pathname = `/a/${gistId}${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isSubdomainOfRoot(host)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (PATH_MODE_WITHOUT_SLASH.test(pathname)) return addTrailingSlash(request);

  // A framed-view address that cannot be a Gist ID is a real 404, decided before any rendering.
  const framed = pathname.match(FRAMED_VIEW);
  if (framed && !isGistId(framed[1].toLowerCase())) {
    // Any path without a route renders the not-found page with a 404 status.
    return NextResponse.rewrite(new URL("/not-an-artifact", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
