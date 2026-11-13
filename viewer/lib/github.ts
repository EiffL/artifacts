/**
 * Minimal GitHub REST client for Gists.
 *
 * Artifact files are NOT served through this API (see gist-source.ts): it is
 * used for metadata, the dashboard, and write actions.
 */

const API = "https://api.github.com";
const USER_AGENT = "gist-artifacts-viewer";

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly rateLimited = false,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/**
 * Credentials for a request. A signed-in person's token is used when given;
 * otherwise the server's own credentials, which only ever read public data.
 */
function authorization(token?: string | null): string | undefined {
  if (token) return `Bearer ${token}`;
  if (process.env.GITHUB_TOKEN) return `Bearer ${process.env.GITHUB_TOKEN}`;
  const id = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.GITHUB_CLIENT_SECRET;
  // OAuth app credentials raise the rate limit for otherwise anonymous reads.
  if (id && secret) return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  return undefined;
}

type RequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

export async function githubFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": USER_AGENT,
  };
  const auth = authorization(options.token);
  if (auth) headers.authorization = auth;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  return fetch(`${API}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
}

async function fail(res: Response): Promise<never> {
  let message = `GitHub responded ${res.status}`;
  try {
    const data = (await res.json()) as { message?: string };
    if (data.message) message = data.message;
  } catch {
    // Keep the generic message.
  }
  const rateLimited =
    res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0");
  throw new GitHubError(res.status, message, rateLimited);
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) await fail(res);
  return (await res.json()) as T;
}

export type GistFile = {
  filename: string;
  type: string;
  size: number;
  raw_url: string;
  truncated?: boolean;
  content?: string;
  encoding?: string;
};

export type GistUser = { login: string; avatar_url: string; html_url: string };

export type GistSummary = {
  id: string;
  description: string | null;
  public: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  owner: GistUser | null;
  files: Record<string, GistFile>;
};

export type GistRevision = {
  version: string;
  committed_at: string;
  user: GistUser | null;
  change_status?: { additions?: number; deletions?: number; total?: number };
};

export type GistDetail = GistSummary & {
  history: GistRevision[];
  fork_of?: { id: string; owner: GistUser | null; html_url: string } | null;
};

export type GistComment = {
  id: number;
  body: string;
  created_at: string;
  user: GistUser | null;
};

export type GitHubUser = { login: string; name: string | null; avatar_url: string };

export async function getGist(
  id: string,
  options: { token?: string | null; rev?: string | null } = {},
): Promise<GistDetail | null> {
  const res = await githubFetch(`/gists/${id}${options.rev ? `/${options.rev}` : ""}`, {
    token: options.token,
  });
  if (res.status === 404) return null;
  return json<GistDetail>(res);
}

export async function getUser(token: string): Promise<GitHubUser> {
  return json<GitHubUser>(await githubFetch("/user", { token }));
}

const PAGE_SIZE = 100;

/** Lists a person's own (`mine`) or starred Gists, newest first, up to `maxPages` pages. */
export async function listGists(
  token: string,
  kind: "mine" | "starred",
  maxPages = 10,
): Promise<{ gists: GistSummary[]; truncated: boolean }> {
  const base = kind === "mine" ? "/gists" : "/gists/starred";
  const gists: GistSummary[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await json<GistSummary[]>(
      await githubFetch(`${base}?per_page=${PAGE_SIZE}&page=${page}`, { token }),
    );
    gists.push(...batch);
    if (batch.length < PAGE_SIZE) return { gists, truncated: false };
  }
  return { gists, truncated: true };
}

export async function listComments(id: string, token?: string | null): Promise<GistComment[]> {
  const res = await githubFetch(`/gists/${id}/comments?per_page=100`, { token });
  if (res.status === 404) return [];
  return json<GistComment[]>(res);
}

export async function isStarred(id: string, token: string): Promise<boolean> {
  const res = await githubFetch(`/gists/${id}/star`, { token });
  return res.status === 204;
}

async function expectOk(res: Response): Promise<void> {
  if (!res.ok) await fail(res);
}

export async function setStar(id: string, token: string, starred: boolean): Promise<void> {
  await expectOk(
    await githubFetch(`/gists/${id}/star`, { token, method: starred ? "PUT" : "DELETE" }),
  );
}

export async function forkGist(id: string, token: string): Promise<GistSummary> {
  return json<GistSummary>(await githubFetch(`/gists/${id}/forks`, { token, method: "POST" }));
}

export async function deleteGist(id: string, token: string): Promise<void> {
  await expectOk(await githubFetch(`/gists/${id}`, { token, method: "DELETE" }));
}

export async function createComment(id: string, token: string, body: string): Promise<GistComment> {
  return json<GistComment>(
    await githubFetch(`/gists/${id}/comments`, { token, method: "POST", body: { body } }),
  );
}

export async function updateGist(
  id: string,
  token: string,
  change: { description?: string; files?: Record<string, { content: string } | null> },
): Promise<GistDetail> {
  return json<GistDetail>(await githubFetch(`/gists/${id}`, { token, method: "PATCH", body: change }));
}
