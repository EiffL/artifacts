#!/usr/bin/env node
/**
 * Gist Artifacts publishing tool.
 *
 * Publishes, updates, reads and lists Gist Artifacts: GitHub Gists that hold an
 * `artifact.json` manifest plus content files.
 *
 * No dependencies. Needs Node.js 18 or newer, a GitHub token with the `gist`
 * scope (from GIST_ARTIFACTS_TOKEN, GH_TOKEN, GITHUB_TOKEN or `gh auth token`),
 * and `git` only when binary files or --base-revision are involved.
 */

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION = "0.1.3";
export const SCHEMA_VERSION = "0.1";
export const MANIFEST = "artifact.json";
export const DEFAULT_VIEWER = "https://gist-artifacts.dev";

const API = "https://api.github.com";
const USER_AGENT = `gist-artifacts-cli/${VERSION}`;
/** Files above this size still work but cannot be cached by the reference viewer. */
const LARGE_FILE_BYTES = 10 * 1024 * 1024;

export const EXIT = { ERROR: 1, USAGE: 2, CONFLICT: 3, AUTH: 4 };

export class CliError extends Error {
  constructor(message, code = EXIT.ERROR) {
    super(message);
    this.code = code;
  }
}

const HELP = `gist-artifacts ${VERSION} - publish pages as versioned GitHub Gists

Usage:
  gist-artifacts publish <file-or-dir>... --title <text> [options]
  gist-artifacts update <gist> [<file-or-dir>...] [options]
  gist-artifacts open <gist> [--rev <sha>] [--out <dir>]
  gist-artifacts list [--limit <n>]
  gist-artifacts comments <gist>
  gist-artifacts reply <gist> --body <text>
  gist-artifacts url <gist> [--rev <sha>]

<gist> is a Gist ID, a gist.github.com URL, or a viewer URL.

Manifest options (publish, update):
  --title <text>          Artifact title. Required when publishing.
  --description <text>    One-sentence summary.
  --entrypoint <name>     File to display. Default: index.html, or the only file.
  --media-type <type>     MIME type of the entrypoint. Default: from its extension.
  --icon <word>           One generic word, such as chart, map or notes.
  --generator <name>      Tool or agent that produced the artifact.
  --source <url>          Code, commit or dataset the artifact was produced from.

publish, update:
  --dry-run               Validate and print what would be published, without writing anything.

publish:
  --public                Create a public Gist. Default: secret (unlisted).

update:
  --remove <name>         Remove a file from the artifact. Repeatable.
  --base-revision <sha>   Fail (exit ${EXIT.CONFLICT}) unless this is still the current revision.

open:
  --rev <sha>             Read a specific revision instead of the current one.
  --out <dir>             Write the artifact's files into this directory.

reply:
  --body <text>           Comment text. Use --body - to read it from stdin.
  --body-file <path>      Read the comment from a file.

Everywhere:
  --json                  Machine-readable output.
  --viewer <url>          Viewer base URL. Default: $GIST_ARTIFACTS_VIEWER or
                          ${DEFAULT_VIEWER}
  --help, --version

Notes:
  A Gist is flat: files are published under their base name, sub-directories
  are not supported. An unlisted Gist is not private: anyone with the link can
  view it.

Exit codes: 0 ok, ${EXIT.ERROR} error, ${EXIT.USAGE} usage, ${EXIT.CONFLICT} revision conflict, ${EXIT.AUTH} authentication.
`;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const VALUE_FLAGS = new Set([
  "title",
  "description",
  "entrypoint",
  "media-type",
  "icon",
  "generator",
  "source",
  "viewer",
  "rev",
  "out",
  "body",
  "body-file",
  "base-revision",
  "limit",
]);
const LIST_FLAGS = new Set(["remove"]);
const BOOLEAN_FLAGS = new Set(["public", "json", "help", "version", "dry-run"]);
const MANIFEST_FLAGS = ["title", "description", "entrypoint", "media-type", "icon", "generator", "source"];

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg === "-h") {
      flags.help = true;
      continue;
    }
    if (!arg.startsWith("--") || arg === "-") {
      positional.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    const name = arg.slice(2, equals === -1 ? undefined : equals);
    const inline = equals === -1 ? undefined : arg.slice(equals + 1);
    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = true;
    } else if (VALUE_FLAGS.has(name) || LIST_FLAGS.has(name)) {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new CliError(`--${name} needs a value.`, EXIT.USAGE);
      if (LIST_FLAGS.has(name)) (flags[name] ??= []).push(value);
      else flags[name] = value;
    } else {
      throw new CliError(`Unknown option --${name}. Run with --help for usage.`, EXIT.USAGE);
    }
  }
  return { flags, positional };
}

/** Extracts a Gist ID from an ID, a gist.github.com URL, or a viewer URL. */
export function parseGistRef(input) {
  const text = String(input ?? "").trim().toLowerCase();
  if (/^[0-9a-f]{7,40}$/.test(text)) return text;
  const matches = text.match(/[0-9a-f]{7,40}/g) ?? [];
  const id = matches.find((m) => m.length === 32) ?? matches.find((m) => m.length !== 40);
  if (!id) throw new CliError(`"${input}" is not a Gist ID or URL.`, EXIT.USAGE);
  return id;
}

function requireSha(value, flag) {
  const sha = String(value).trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new CliError(`${flag} must be a full 40-character commit SHA.`, EXIT.USAGE);
  }
  return sha;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

const MEDIA_TYPES = {
  html: "text/html",
  htm: "text/html",
  md: "text/markdown",
  markdown: "text/markdown",
  svg: "image/svg+xml",
  txt: "text/plain",
  json: "application/json",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function inferMediaType(filename) {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? undefined : MEDIA_TYPES[filename.slice(dot + 1).toLowerCase()];
}

/** `type/subtype`, optionally followed by parameters. */
const MEDIA_TYPE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*(\s*;.*)?$/;

const MANIFEST_ORDER = [
  "schemaVersion",
  "title",
  "entrypoint",
  "mediaType",
  "description",
  "icon",
  "generator",
  "source",
];

/**
 * Builds the manifest from an existing one (if any) plus command-line options,
 * and checks it against the files the artifact will contain.
 *
 * @param {Record<string, unknown> | null} existing
 * @param {Record<string, any>} flags
 * @param {string[]} fileNames content files, without the manifest
 */
export function buildManifest(existing, flags, fileNames) {
  if (existing !== null && (typeof existing !== "object" || Array.isArray(existing))) {
    throw new CliError(`${MANIFEST} must contain a JSON object.`);
  }
  const merged = { ...(existing ?? {}) };
  const set = (key, value) => {
    if (value === undefined) return;
    const text = String(value).trim();
    if (text) merged[key] = text;
    else delete merged[key];
  };
  set("title", flags.title);
  set("description", flags.description);
  set("entrypoint", flags.entrypoint);
  set("mediaType", flags["media-type"]);
  set("icon", flags.icon);
  set("generator", flags.generator ?? (existing ? undefined : process.env.GIST_ARTIFACTS_GENERATOR));
  set("source", flags.source);
  merged.schemaVersion ??= SCHEMA_VERSION;

  if (typeof merged.title !== "string" || !merged.title.trim()) {
    throw new CliError("A title is required: pass --title.", EXIT.USAGE);
  }
  if (/[\r\n]/.test(merged.title)) {
    throw new CliError("The title must be a single line.", EXIT.USAGE);
  }
  if (merged.source !== undefined && !/^https?:\/\/\S+$/.test(merged.source)) {
    throw new CliError(`The source must be an absolute http(s) URL, not "${merged.source}".`, EXIT.USAGE);
  }

  if (merged.entrypoint === undefined) {
    if (fileNames.includes("index.html")) merged.entrypoint = "index.html";
    else if (fileNames.length === 1) merged.entrypoint = fileNames[0];
    else {
      throw new CliError(
        "Cannot tell which file to display: pass --entrypoint <name> (there is no index.html).",
        EXIT.USAGE,
      );
    }
  }
  if (typeof merged.entrypoint !== "string" || merged.entrypoint.includes("/")) {
    throw new CliError("The entrypoint must be a file name, not a path.", EXIT.USAGE);
  }
  if (!fileNames.includes(merged.entrypoint)) {
    throw new CliError(
      `The entrypoint "${merged.entrypoint}" is not among the artifact's files (${fileNames.join(", ") || "none"}).`,
      EXIT.USAGE,
    );
  }

  // A new entrypoint invalidates a media type that was only ever inferred.
  if (flags.entrypoint !== undefined && flags["media-type"] === undefined && existing) {
    delete merged.mediaType;
  }
  merged.mediaType ??= inferMediaType(merged.entrypoint);
  if (typeof merged.mediaType !== "string" || !merged.mediaType) {
    throw new CliError(
      `Cannot infer a media type for "${merged.entrypoint}": pass --media-type.`,
      EXIT.USAGE,
    );
  }
  if (!MEDIA_TYPE.test(merged.mediaType)) {
    throw new CliError(`"${merged.mediaType}" is not a media type such as text/html.`, EXIT.USAGE);
  }

  const ordered = {};
  for (const key of MANIFEST_ORDER) if (merged[key] !== undefined) ordered[key] = merged[key];
  for (const key of Object.keys(merged)) if (!(key in ordered)) ordered[key] = merged[key];
  return ordered;
}

export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseManifestText(text, where) {
  try {
    return JSON.parse(text);
  } catch {
    throw new CliError(`${where} is not valid JSON.`);
  }
}

// ---------------------------------------------------------------------------
// Local files
// ---------------------------------------------------------------------------

/** Returns the text of a buffer, or null when it is not valid UTF-8 text. */
export function decodeText(bytes) {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Reads the given files and directories into a flat map of Gist file names.
 * A directory contributes its direct files; sub-directories are rejected
 * because a Gist cannot hold them.
 *
 * @returns {Map<string, { bytes: Buffer, text: string | null }>}
 */
export function collectFiles(paths) {
  const files = new Map();
  const add = (path) => {
    const name = basename(path);
    if (files.has(name)) {
      throw new CliError(`Two files are named "${name}". A Gist is flat, so file names must be unique.`);
    }
    if (/^gistfile\d+/i.test(name)) {
      throw new CliError(`"${name}" clashes with GitHub's automatic Gist file names. Rename it.`);
    }
    const bytes = readFileSync(path);
    if (bytes.length === 0) throw new CliError(`"${name}" is empty. Gists cannot hold empty files.`);
    files.set(name, { bytes, text: decodeText(bytes) });
  };

  for (const input of paths) {
    const path = resolve(input);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      throw new CliError(`No such file or directory: ${input}`);
    }
    if (!stat.isDirectory()) {
      add(path);
      continue;
    }
    const nested = [];
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) nested.push(entry.name);
      else if (entry.isFile()) add(join(path, entry.name));
    }
    if (nested.length > 0) {
      throw new CliError(
        `${input} contains sub-directories (${nested.join(", ")}). A Gist is flat: move every file to the top level and reference it by its bare name.`,
      );
    }
  }
  return files;
}

function textFile(text) {
  return { bytes: Buffer.from(text, "utf8"), text };
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

let cachedToken;
/** Where the token came from: the name of an environment variable, or "gh". */
let tokenSource = null;
let ghInstalled = true;

/** @returns {string | null} */
function findToken() {
  if (cachedToken !== undefined) return cachedToken;
  for (const name of ["GIST_ARTIFACTS_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"]) {
    const value = process.env[name]?.trim();
    if (value) {
      tokenSource = name;
      return (cachedToken = value);
    }
  }
  const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  ghInstalled = gh.error?.code !== "ENOENT";
  const value = gh.status === 0 ? gh.stdout.trim() : "";
  if (value) tokenSource = "gh";
  return (cachedToken = value || null);
}

const TOKEN_ALTERNATIVE = "or set GH_TOKEN to a token with the gist scope";

function requireToken() {
  const token = findToken();
  if (!token) {
    throw new CliError(
      ghInstalled
        ? `Not signed in to GitHub. Run \`gh auth login -s gist\`, ${TOKEN_ALTERNATIVE}.`
        : `Not signed in to GitHub, and the GitHub CLI (gh) is not installed. Install it from https://cli.github.com and run \`gh auth login -s gist\`, ${TOKEN_ALTERNATIVE}.`,
      EXIT.AUTH,
    );
  }
  return token;
}

/**
 * Whether a sign-in lacks the gist permission, from GitHub's `x-oauth-scopes` response header.
 * The header lists the scopes of an OAuth or classic token; other kinds of token do not send
 * it, and then nothing can be concluded.
 */
export function lacksGistScope(scopesHeader) {
  if (scopesHeader === null || scopesHeader === undefined) return false;
  return !scopesHeader.split(",").some((scope) => scope.trim() === "gist");
}

/** The one command, or change, that gives the current sign-in the gist permission. */
function gistScopeFix() {
  return tokenSource === "gh" || tokenSource === null
    ? "Run `gh auth refresh -s gist`."
    : `The token in ${tokenSource} needs the gist scope: use one that has it, or unset ${tokenSource} and run \`gh auth login -s gist\`.`;
}

/**
 * Calls the GitHub REST API. With `auth: "optional"` a token is used when one
 * is available, which is enough for reading public and unlisted Gists.
 */
async function github(path, { method = "GET", body, auth = "required" } = {}) {
  const token = auth === "required" ? requireToken() : findToken();
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": USER_AGENT,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new CliError(`Could not reach GitHub: ${error.message}`);
  }
  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body; handled below through the status.
  }
  if (res.ok) return data;

  const detail = data?.message ? ` (${data.message})` : "";
  if (res.status === 401) {
    throw new CliError(`GitHub rejected the sign-in${detail}. Run \`gh auth login -s gist\`.`, EXIT.AUTH);
  }
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new CliError("GitHub rate limit reached. Try again later, or authenticate with `gh auth login`.");
  }
  if ((res.status === 404 || res.status === 403) && token && lacksGistScope(res.headers.get("x-oauth-scopes"))) {
    throw new CliError(`The GitHub sign-in does not have the gist permission. ${gistScopeFix()}`, EXIT.AUTH);
  }
  if (res.status === 404 || res.status === 403) {
    const hint =
      method === "GET"
        ? "Check the Gist ID."
        : "Check the Gist ID, that you own the Gist, and that the token has the gist scope (`gh auth refresh -s gist`).";
    throw new CliError(`GitHub responded ${res.status}${detail}. ${hint}`, res.status === 403 ? EXIT.AUTH : EXIT.ERROR);
  }
  throw new CliError(`GitHub responded ${res.status}${detail}.`);
}

function headOf(gist) {
  return gist.history?.[0]?.version ?? null;
}

/** Full content of a Gist file as returned by the API, fetching it when truncated. */
async function fileBytes(file) {
  if (!file.truncated && typeof file.content === "string") {
    return Buffer.from(file.content, file.encoding === "base64" ? "base64" : "utf8");
  }
  const res = await fetch(file.raw_url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new CliError(`Could not download ${file.filename} (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Git (binary files and conflict-checked updates)
// ---------------------------------------------------------------------------

function git(args, { cwd, token, allowFailure = false } = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  if (token) {
    // The token travels in the environment, never in the command line or in .git/config.
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    env.GIT_CONFIG_COUNT = "2";
    env.GIT_CONFIG_KEY_0 = "credential.helper";
    env.GIT_CONFIG_VALUE_0 = "";
    env.GIT_CONFIG_KEY_1 = "http.https://gist.github.com/.extraheader";
    env.GIT_CONFIG_VALUE_1 = `Authorization: Basic ${basic}`;
  }
  const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  if (result.error) {
    throw new CliError("git is required for binary files and --base-revision, but it could not be run.");
  }
  if (result.status !== 0 && !allowFailure) {
    throw new CliError(`git ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function conflict(base, current) {
  return new CliError(
    `Revision conflict: the artifact is at ${current}, not ${base}. Run \`open\` to read the current revision, merge your change, and retry.`,
    EXIT.CONFLICT,
  );
}

/**
 * Applies file changes as one Git commit and pushes it. A push that is not a
 * fast-forward is rejected by GitHub, which makes this safe against
 * concurrent updates.
 */
async function commitWithGit(id, { write, remove, baseRevision, message }) {
  const token = requireToken();
  const dir = mkdtempSync(join(tmpdir(), "gist-artifact-"));
  try {
    git(["clone", "--quiet", "--depth", "1", `https://gist.github.com/${id}.git`, dir], { token });
    const head = git(["rev-parse", "HEAD"], { cwd: dir }).stdout.trim();
    if (baseRevision && head !== baseRevision) throw conflict(baseRevision, head);

    for (const [name, file] of write) writeFileSync(join(dir, name), file.bytes);
    if (write.size > 0) git(["add", "--", ...write.keys()], { cwd: dir });
    if (remove.length > 0) git(["rm", "--quiet", "--", ...remove], { cwd: dir });

    if (!git(["status", "--porcelain"], { cwd: dir }).stdout.trim()) {
      return { revision: head, changed: false };
    }

    const identity = [];
    if (!git(["config", "user.email"], { cwd: dir, allowFailure: true }).stdout.trim()) {
      const user = await github("/user");
      identity.push(
        "-c",
        `user.name=${user.name || user.login}`,
        "-c",
        `user.email=${user.id}+${user.login}@users.noreply.github.com`,
      );
    }
    git([...identity, "commit", "--quiet", "-m", message], { cwd: dir });

    const push = git(["push", "--quiet", "origin", "HEAD"], { cwd: dir, token, allowFailure: true });
    if (push.status !== 0) {
      if (/rejected|non-fast-forward|fetch first/i.test(push.stderr)) {
        throw conflict(baseRevision ?? head, "a newer revision");
      }
      throw new CliError(`git push failed: ${push.stderr.trim()}`);
    }
    return { revision: git(["rev-parse", "HEAD"], { cwd: dir }).stdout.trim(), changed: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

function viewerBase(flags) {
  return (flags.viewer ?? process.env.GIST_ARTIFACTS_VIEWER ?? DEFAULT_VIEWER).replace(/\/+$/, "");
}

export function viewerUrls(base, id, revision) {
  return {
    viewerUrl: `${base}/g/${id}`,
    pinnedUrl: revision ? `${base}/g/${id}?rev=${revision}` : null,
  };
}

/** Tells the viewer a new revision exists so it shows up immediately. Never fatal. */
async function notifyViewer(base, id) {
  try {
    const res = await fetch(`${base}/api/revalidate?gist=${id}`, {
      method: "POST",
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function warnLargeFiles(files) {
  for (const [name, file] of files) {
    if (file.bytes.length > LARGE_FILE_BYTES) {
      console.error(
        `warning: ${name} is ${(file.bytes.length / 1024 / 1024).toFixed(1)} MB. Files over 10 MB are served slowly; consider hosting it elsewhere.`,
      );
    }
  }
}

function printResult(flags, result, lines) {
  if (flags.json) console.log(JSON.stringify(result, null, 2));
  else console.log(lines.filter(Boolean).join("\n"));
}

function linkLines(result) {
  return [
    `  Artifact:  ${result.viewerUrl}`,
    result.pinnedUrl && `  Pinned:    ${result.pinnedUrl}`,
    `  Source:    ${result.sourceUrl}`,
    result.revision && `  Revision:  ${result.revision}`,
  ];
}

async function publish(positional, flags) {
  if (positional.length === 0) {
    throw new CliError("Nothing to publish: pass files or a directory.", EXIT.USAGE);
  }
  const files = collectFiles(positional);
  const provided = files.get(MANIFEST);
  if (provided && provided.text === null) throw new CliError(`${MANIFEST} is not a text file.`);
  const names = [...files.keys()].filter((name) => name !== MANIFEST);
  if (names.length === 0) throw new CliError("Nothing to publish besides the manifest.", EXIT.USAGE);

  const manifest = buildManifest(
    provided ? parseManifestText(provided.text, MANIFEST) : null,
    flags,
    names,
  );
  files.set(MANIFEST, textFile(serializeManifest(manifest)));
  warnLargeFiles(files);

  const text = [...files].filter(([, file]) => file.text !== null);
  const binary = new Map([...files].filter(([, file]) => file.text === null));

  if (flags["dry-run"]) {
    printResult(
      flags,
      { dryRun: true, manifest, files: [...files.keys()], binaryFiles: [...binary.keys()] },
      [
        "Dry run: nothing was published.",
        `  Files:     ${[...files.keys()].join(", ")}`,
        binary.size > 0 && `  Binary:    ${[...binary.keys()].join(", ")} (pushed with git)`,
        "  Manifest:",
        serializeManifest(manifest).trimEnd().replace(/^/gm, "    "),
      ],
    );
    return;
  }

  const gist = await github("/gists", {
    method: "POST",
    body: {
      description: manifest.title,
      public: Boolean(flags.public),
      files: Object.fromEntries(text.map(([name, file]) => [name, { content: file.text }])),
    },
  });

  let revision = headOf(gist);
  if (binary.size > 0) {
    try {
      ({ revision } = await commitWithGit(gist.id, {
        write: binary,
        remove: [],
        message: "Add binary files",
      }));
    } catch (error) {
      throw new CliError(
        `Gist ${gist.id} was created, but its binary files could not be added: ${error.message}\n` +
          `Fix the problem and run: update ${gist.id} ${[...binary.keys()].join(" ")}`,
        error.code ?? EXIT.ERROR,
      );
    }
  }

  const base = viewerBase(flags);
  const notified = await notifyViewer(base, gist.id);
  const result = {
    gistId: gist.id,
    revision,
    visibility: gist.public ? "public" : "unlisted",
    sourceUrl: gist.html_url,
    ...viewerUrls(base, gist.id, revision),
    viewerNotified: notified,
  };
  printResult(flags, result, [
    `Published "${manifest.title}" (${result.visibility}).`,
    ...linkLines(result),
  ]);
}

async function update(positional, flags) {
  const [ref, ...paths] = positional;
  if (!ref) throw new CliError("Pass the Gist to update.", EXIT.USAGE);
  const id = parseGistRef(ref);
  const baseRevision = flags["base-revision"] ? requireSha(flags["base-revision"], "--base-revision") : null;

  const gist = await github(`/gists/${id}`);
  const head = headOf(gist);
  if (baseRevision && head !== baseRevision) throw conflict(baseRevision, head);

  const files = paths.length > 0 ? collectFiles(paths) : new Map();
  const current = new Set(Object.keys(gist.files));
  const remove = flags.remove ?? [];
  for (const name of remove) {
    if (name === MANIFEST) throw new CliError(`${MANIFEST} cannot be removed from an artifact.`, EXIT.USAGE);
    if (!current.has(name)) throw new CliError(`Cannot remove "${name}": it is not in the artifact.`);
    if (files.has(name)) throw new CliError(`"${name}" is both updated and removed.`, EXIT.USAGE);
  }

  const resulting = new Set([...current, ...files.keys()]);
  for (const name of remove) resulting.delete(name);
  resulting.delete(MANIFEST);
  const names = [...resulting];

  const existingFile = gist.files[MANIFEST];
  const existingText = existingFile ? (await fileBytes(existingFile)).toString("utf8") : null;
  const provided = files.get(MANIFEST);
  if (provided && provided.text === null) throw new CliError(`${MANIFEST} is not a text file.`);

  const manifest = buildManifest(
    provided
      ? parseManifestText(provided.text, MANIFEST)
      : existingText
        ? parseManifestText(existingText, `The artifact's ${MANIFEST}`)
        : null,
    flags,
    names,
  );
  const manifestText = serializeManifest(manifest);
  const manifestTouched = Boolean(provided) || MANIFEST_FLAGS.some((flag) => flags[flag] !== undefined);
  if (manifestTouched || existingText === null) files.set(MANIFEST, textFile(manifestText));

  if (files.size === 0 && remove.length === 0) {
    throw new CliError("Nothing to update: pass files, --remove, or a manifest option.", EXIT.USAGE);
  }

  // GitHub records a new revision even for identical content, so drop files that would not change.
  for (const [name, file] of [...files]) {
    const existing = gist.files[name];
    if (existing?.size === file.bytes.length && (await fileBytes(existing)).equals(file.bytes)) {
      files.delete(name);
    }
  }
  const base = viewerBase(flags);
  if (files.size === 0 && remove.length === 0) {
    const result = {
      gistId: id,
      revision: head,
      previousRevision: head,
      changed: false,
      sourceUrl: gist.html_url,
      ...viewerUrls(base, id, head),
      viewerNotified: false,
    };
    printResult(flags, result, [
      `No change: "${manifest.title}" already has this content.`,
      ...linkLines(result),
    ]);
    return;
  }
  warnLargeFiles(files);

  if (flags["dry-run"]) {
    printResult(
      flags,
      { dryRun: true, gistId: id, revision: head, manifest, files: [...files.keys()], remove },
      [
        `Dry run: nothing was published to "${manifest.title}".`,
        files.size > 0 && `  Would write:   ${[...files.keys()].join(", ")}`,
        remove.length > 0 && `  Would remove:  ${remove.join(", ")}`,
        "  Manifest:",
        manifestText.trimEnd().replace(/^/gm, "    "),
      ],
    );
    return;
  }

  const needsGit = baseRevision !== null || [...files.values()].some((file) => file.text === null);
  // The Gist description mirrors the title; only rewrite it when the manifest is being changed.
  const titleChanged = (manifestTouched || !gist.description) && manifest.title !== gist.description;
  let revision;
  let changed;

  if (needsGit) {
    ({ revision, changed } = await commitWithGit(id, {
      write: files,
      remove,
      baseRevision,
      message: "Update artifact",
    }));
    if (titleChanged) await github(`/gists/${id}`, { method: "PATCH", body: { description: manifest.title } });
  } else {
    // One PATCH is one revision, however many files it touches.
    const patch = Object.fromEntries([...files].map(([name, file]) => [name, { content: file.text }]));
    for (const name of remove) patch[name] = null;
    const updated = await github(`/gists/${id}`, {
      method: "PATCH",
      body: { files: patch, ...(titleChanged ? { description: manifest.title } : {}) },
    });
    revision = headOf(updated);
    changed = revision !== head;
  }

  const notified = changed ? await notifyViewer(base, id) : false;
  const result = {
    gistId: id,
    revision,
    previousRevision: head,
    changed,
    sourceUrl: gist.html_url,
    ...viewerUrls(base, id, revision),
    viewerNotified: notified,
  };
  printResult(flags, result, [
    changed ? `Updated "${manifest.title}".` : `No change: "${manifest.title}" already has this content.`,
    ...linkLines(result),
  ]);
}

async function open(positional, flags) {
  const [ref] = positional;
  if (!ref) throw new CliError("Pass the Gist to open.", EXIT.USAGE);
  const id = parseGistRef(ref);
  const rev = flags.rev ? requireSha(flags.rev, "--rev") : null;

  const gist = await github(`/gists/${id}${rev ? `/${rev}` : ""}`, { auth: "optional" });
  // A pinned read reports the revision that was asked for; history always lists the latest first.
  const revision = rev ?? headOf(gist);
  const manifestFile = gist.files[MANIFEST];
  let manifest = null;
  if (manifestFile) {
    try {
      manifest = JSON.parse((await fileBytes(manifestFile)).toString("utf8"));
    } catch {
      manifest = null;
    }
  }

  const fileList = Object.values(gist.files).map((file) => ({
    name: file.filename,
    size: file.size,
    type: file.type,
  }));

  let written = null;
  if (flags.out) {
    written = resolve(flags.out);
    mkdirSync(written, { recursive: true });
    for (const file of Object.values(gist.files)) {
      if (file.filename.includes("/") || file.filename.includes("\\")) continue;
      writeFileSync(join(written, file.filename), await fileBytes(file));
    }
  }

  const base = viewerBase(flags);
  const result = {
    gistId: id,
    revision,
    owner: gist.owner?.login ?? null,
    visibility: gist.public ? "public" : "unlisted",
    conforming: manifest !== null,
    manifest,
    files: fileList,
    sourceUrl: gist.html_url,
    ...viewerUrls(base, id, revision),
    writtenTo: written,
  };
  printResult(flags, result, [
    manifest ? `"${manifest.title ?? "(untitled)"}" by ${result.owner ?? "unknown"} (${result.visibility})` : `Gist ${id} has no ${MANIFEST}: it is not an artifact.`,
    ...linkLines(result),
    manifest && `  Entry:     ${manifest.entrypoint} (${manifest.mediaType})`,
    manifest?.description && `  About:     ${manifest.description}`,
    "  Files:",
    ...fileList.map((file) => `    ${file.name}  (${file.size} bytes)`),
    written && `  Written to ${written}`,
  ]);
}

async function list(_positional, flags) {
  const limit = flags.limit ? Number.parseInt(flags.limit, 10) : Infinity;
  if (Number.isNaN(limit) || limit < 1) throw new CliError("--limit must be a positive number.", EXIT.USAGE);
  const base = viewerBase(flags);
  const artifacts = [];
  for (let page = 1; page <= 10 && artifacts.length < limit; page++) {
    const batch = await github(`/gists?per_page=100&page=${page}`);
    for (const gist of batch) {
      if (!(MANIFEST in gist.files)) continue;
      artifacts.push({
        gistId: gist.id,
        title: gist.description || "(untitled)",
        visibility: gist.public ? "public" : "unlisted",
        updatedAt: gist.updated_at,
        comments: gist.comments,
        sourceUrl: gist.html_url,
        viewerUrl: `${base}/g/${gist.id}`,
      });
    }
    if (batch.length < 100) break;
  }
  const shown = artifacts.slice(0, limit === Infinity ? undefined : limit);
  if (flags.json) {
    console.log(JSON.stringify(shown, null, 2));
    return;
  }
  if (shown.length === 0) {
    console.log("No artifacts found among your Gists.");
    return;
  }
  for (const artifact of shown) {
    console.log(`${artifact.updatedAt.slice(0, 10)}  ${artifact.visibility.padEnd(8)}  ${artifact.title}`);
    console.log(`            ${artifact.viewerUrl}`);
  }
}

async function comments(positional, flags) {
  const [ref] = positional;
  if (!ref) throw new CliError("Pass the Gist whose comments to read.", EXIT.USAGE);
  const id = parseGistRef(ref);
  const data = await github(`/gists/${id}/comments?per_page=100`, { auth: "optional" });
  const thread = data.map((comment) => ({
    id: comment.id,
    author: comment.user?.login ?? null,
    createdAt: comment.created_at,
    body: comment.body,
  }));
  if (flags.json) {
    console.log(JSON.stringify(thread, null, 2));
    return;
  }
  if (thread.length === 0) {
    console.log("No comments.");
    return;
  }
  for (const comment of thread) {
    console.log(`@${comment.author ?? "ghost"} on ${comment.createdAt}:`);
    console.log(comment.body.replace(/^/gm, "  "));
    console.log("");
  }
}

async function reply(positional, flags) {
  const [ref] = positional;
  if (!ref) throw new CliError("Pass the Gist to comment on.", EXIT.USAGE);
  const id = parseGistRef(ref);
  let body = flags.body;
  if (flags["body-file"]) body = readFileSync(flags["body-file"], "utf8");
  if (body === "-") body = readFileSync(0, "utf8");
  if (!body?.trim()) {
    throw new CliError("Pass the comment with --body <text>, --body-file <path>, or --body - for stdin.", EXIT.USAGE);
  }

  const comment = await github(`/gists/${id}/comments`, { method: "POST", body: { body: body.trim() } });
  printResult(flags, { gistId: id, commentId: comment.id, url: comment.url }, [
    `Comment posted on ${id}.`,
  ]);
}

async function url(positional, flags) {
  const [ref] = positional;
  if (!ref) throw new CliError("Pass a Gist.", EXIT.USAGE);
  const id = parseGistRef(ref);
  const rev = flags.rev ? requireSha(flags.rev, "--rev") : null;
  const result = { gistId: id, sourceUrl: `https://gist.github.com/${id}`, ...viewerUrls(viewerBase(flags), id, rev) };
  printResult(flags, result, [rev ? result.pinnedUrl : result.viewerUrl]);
}

const COMMANDS = { publish, update, open, list, comments, reply, url };
/** Commands that write and know how to stop short of it. */
const DRY_RUN_COMMANDS = new Set(["publish", "update"]);

export async function main(argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.version) {
    console.log(VERSION);
    return;
  }
  const [command, ...rest] = positional;
  if (flags.help || !command) {
    console.log(HELP);
    return;
  }
  const run = COMMANDS[command];
  if (!run) throw new CliError(`Unknown command "${command}". Run with --help for usage.`, EXIT.USAGE);
  // An ignored --dry-run would do the real thing, so refuse it where it has no meaning.
  if (flags["dry-run"] && !DRY_RUN_COMMANDS.has(command)) {
    throw new CliError(`--dry-run is not available for "${command}": only for publish and update.`, EXIT.USAGE);
  }
  await run(rest, flags);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    // Compare real paths: the script may be reached through a symlinked skills directory.
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main(process.argv.slice(2)).catch((error) => {
    if (error instanceof CliError) {
      console.error(`error: ${error.message}`);
      process.exit(error.code);
    }
    console.error(error);
    process.exit(EXIT.ERROR);
  });
}
