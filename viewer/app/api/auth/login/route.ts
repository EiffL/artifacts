import { NextResponse, type NextRequest } from "next/server";

import { gistIdFromHost } from "@/lib/config";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE, authConfigured, cookieOptions, seal } from "@/lib/session";
import { requestOrigin } from "@/lib/urls";

/** Only same-site relative paths are accepted as a post-login destination. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request.headers);
  if (gistIdFromHost(request.headers.get("host"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!authConfigured()) {
    return NextResponse.redirect(`${origin}/?auth=unconfigured`);
  }

  const state = crypto.randomUUID();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  // `scope=public` signs in without the gist scope: public artifacts only, no write actions.
  const scope = request.nextUrl.searchParams.get("scope") === "public" ? "" : "gist";

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  authorize.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
  authorize.searchParams.set("state", state);
  if (scope) authorize.searchParams.set("scope", scope);

  const response = NextResponse.redirect(authorize);
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    await seal({ state, next }, OAUTH_STATE_MAX_AGE),
    cookieOptions(OAUTH_STATE_MAX_AGE),
  );
  return response;
}
