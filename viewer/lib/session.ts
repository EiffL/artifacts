import "server-only";

import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

/**
 * Sessions are stateless: the GitHub access token lives only in an encrypted,
 * HTTP-only cookie. Nothing is stored server-side.
 *
 * In production the cookie uses the `__Host-` prefix, which makes it host-only
 * (never sent to artifact subdomains) and impossible for a subdomain to
 * overwrite.
 */

export type Session = {
  token: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  /** Scopes GitHub granted, e.g. "gist" or "" for a public-only sign-in. */
  scope: string;
};

const PRODUCTION = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = PRODUCTION ? "__Host-ga-session" : "ga-session";
export const OAUTH_STATE_COOKIE = PRODUCTION ? "__Host-ga-oauth" : "ga-oauth";

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
export const OAUTH_STATE_MAX_AGE = 10 * 60;

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: PRODUCTION,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** True when GitHub sign-in can work on this deployment. */
export function authConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      (process.env.SESSION_SECRET || !PRODUCTION),
  );
}

async function encryptionKey(): Promise<Uint8Array> {
  const secret = process.env.SESSION_SECRET ?? (PRODUCTION ? "" : "development-only-session-secret");
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

export async function seal(payload: Record<string, unknown>, maxAgeSeconds: number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .encrypt(await encryptionKey());
}

export async function unseal<T>(value: string | undefined): Promise<T | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, await encryptionKey());
    return payload as T;
  } catch {
    return null;
  }
}

/** The signed-in person, or null. Reads the request, so call it behind a Suspense boundary. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = await unseal<Session>(store.get(SESSION_COOKIE)?.value);
  return session?.token && session.login ? session : null;
}

/** Narrow, client-safe view of the session: never includes the token. */
export type Viewer = { login: string; name: string | null; avatarUrl: string; canWrite: boolean };

export function toViewer(session: Session): Viewer {
  return {
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
    canWrite: session.scope.split(/[\s,]+/).includes("gist"),
  };
}
