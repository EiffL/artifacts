import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/github";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  cookieOptions,
  seal,
  unseal,
  type Session,
} from "@/lib/session";
import { requestOrigin } from "@/lib/urls";

type TokenResponse = { access_token?: string; scope?: string; error?: string };

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request.headers);
  const failure = (reason: string) => {
    const response = NextResponse.redirect(`${origin}/?auth=${reason}`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  };

  if (!authConfigured()) return failure("unconfigured");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const saved = await unseal<{ state: string; next: string }>(
    request.cookies.get(OAUTH_STATE_COOKIE)?.value,
  );
  if (!code || !state || !saved || saved.state !== state) return failure("failed");

  let session: Session;
  try {
    const exchange = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/auth/callback`,
      }),
      cache: "no-store",
    });
    const token = (await exchange.json()) as TokenResponse;
    if (!token.access_token) return failure("failed");

    const user = await getUser(token.access_token);
    session = {
      token: token.access_token,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      scope: token.scope ?? "",
    };
  } catch {
    return failure("failed");
  }

  const response = NextResponse.redirect(`${origin}${saved.next}`);
  response.cookies.set(SESSION_COOKIE, await seal(session, SESSION_MAX_AGE), cookieOptions(SESSION_MAX_AGE));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
