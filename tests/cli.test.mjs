// Tests for the publishing tool. Run with: node --test tests/
// Nothing here touches the network or GitHub.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CliError,
  EXIT,
  MANIFEST,
  buildManifest,
  collectFiles,
  decodeText,
  inferMediaType,
  lacksGistScope,
  parseArgs,
  parseGistRef,
  serializeManifest,
  viewerUrls,
} from "../plugins/gist-artifacts/skills/gist-artifacts/scripts/gist-artifacts.mjs";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../plugins/gist-artifacts/skills/gist-artifacts/scripts/gist-artifacts.mjs",
);
const ID = "b9c4c481ad2dfa225f167fd845f5e7be";
const SHA = "9eabcbcf5f74453ba542b42f8291766f2d4683ac";

const scratch = mkdtempSync(join(tmpdir(), "gist-artifacts-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function dir(name, files) {
  const path = join(scratch, name);
  mkdirSync(path, { recursive: true });
  for (const [file, content] of Object.entries(files)) writeFileSync(join(path, file), content);
  return path;
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    input: "",
  });
}

function usageError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.code, EXIT.USAGE);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

describe("parseArgs", () => {
  test("separates options from positional arguments", () => {
    const { flags, positional } = parseArgs(["publish", "out", "--title", "Hello", "--public", "--json"]);
    assert.deepEqual(positional, ["publish", "out"]);
    assert.deepEqual(flags, { title: "Hello", public: true, json: true });
  });

  test("accepts --name=value and repeated list options", () => {
    const { flags } = parseArgs(["--title=A = B", "--remove", "a.txt", "--remove=b.txt"]);
    assert.equal(flags.title, "A = B");
    assert.deepEqual(flags.remove, ["a.txt", "b.txt"]);
  });

  test("keeps a lone dash and everything after -- positional", () => {
    assert.deepEqual(parseArgs(["reply", "x", "--body", "-"]).flags.body, "-");
    assert.deepEqual(parseArgs(["a", "--", "--title"]).positional, ["a", "--title"]);
  });

  test("rejects unknown options and missing values", () => {
    usageError(() => parseArgs(["--nope"]), /Unknown option/);
    usageError(() => parseArgs(["--title"]), /needs a value/);
  });
});

describe("parseGistRef", () => {
  test("accepts an ID, a Gist URL and viewer URLs", () => {
    assert.equal(parseGistRef(ID), ID);
    assert.equal(parseGistRef(ID.toUpperCase()), ID);
    assert.equal(parseGistRef(`https://gist.github.com/EiffL/${ID}`), ID);
    assert.equal(parseGistRef(`https://viewer.example/g/${ID}?rev=${SHA}`), ID);
    assert.equal(parseGistRef(`https://${ID}.viewer.example/@${SHA}/`), ID);
  });

  test("rejects text without an ID", () => {
    usageError(() => parseGistRef("not a gist"));
    usageError(() => parseGistRef(""));
  });
});

describe("buildManifest", () => {
  test("defaults the entrypoint to index.html and infers the media type", () => {
    const manifest = buildManifest(null, { title: "Report" }, ["data.json", "index.html"]);
    assert.deepEqual(manifest, {
      schemaVersion: "0.1",
      title: "Report",
      entrypoint: "index.html",
      mediaType: "text/html",
    });
  });

  test("uses the only file as entrypoint", () => {
    const manifest = buildManifest(null, { title: "Notes" }, ["notes.md"]);
    assert.equal(manifest.entrypoint, "notes.md");
    assert.equal(manifest.mediaType, "text/markdown");
  });

  test("requires a title and a resolvable entrypoint", () => {
    usageError(() => buildManifest(null, {}, ["index.html"]), /title/);
    usageError(() => buildManifest(null, { title: "x" }, ["a.css", "b.js"]), /--entrypoint/);
    usageError(() => buildManifest(null, { title: "x", entrypoint: "gone.html" }, ["index.html"]), /not among/);
    usageError(() => buildManifest(null, { title: "x", entrypoint: "a/b.html" }, ["a/b.html"]), /file name/);
  });

  test("asks for a media type it cannot infer", () => {
    usageError(() => buildManifest(null, { title: "x" }, ["model.bin"]), /--media-type/);
    const manifest = buildManifest(null, { title: "x", "media-type": "application/octet-stream" }, ["model.bin"]);
    assert.equal(manifest.mediaType, "application/octet-stream");
  });

  test("rejects a multi-line title, a relative source and a malformed media type", () => {
    usageError(() => buildManifest(null, { title: "Two\nlines" }, ["index.html"]), /single line/);
    usageError(() => buildManifest(null, { title: "x", source: "notes.txt" }, ["index.html"]), /absolute http/);
    usageError(() => buildManifest(null, { title: "x", "media-type": "HTML page" }, ["index.html"]), /not a media type/);
    const manifest = buildManifest(
      null,
      { title: "x", source: "https://example.org/r", "media-type": "text/markdown; variant=GFM" },
      ["notes.md"],
    );
    assert.equal(manifest.mediaType, "text/markdown; variant=GFM");
  });

  test("merges options over an existing manifest and keeps unknown properties", () => {
    const existing = {
      custom: { keep: true },
      mediaType: "text/html",
      entrypoint: "index.html",
      title: "Old",
      schemaVersion: "9.9",
      description: "Old description",
    };
    const manifest = buildManifest(existing, { title: "New", description: "" }, ["index.html"]);
    assert.equal(manifest.title, "New");
    // The version an existing manifest declares is kept, not overwritten.
    assert.equal(manifest.schemaVersion, "9.9");
    assert.equal("description" in manifest, false);
    assert.deepEqual(manifest.custom, { keep: true });
    assert.deepEqual(Object.keys(manifest), ["schemaVersion", "title", "entrypoint", "mediaType", "custom"]);
  });

  test("re-infers the media type when the entrypoint changes", () => {
    const existing = { schemaVersion: "0.1", title: "T", entrypoint: "index.html", mediaType: "text/html" };
    const manifest = buildManifest(existing, { entrypoint: "report.md" }, ["index.html", "report.md"]);
    assert.equal(manifest.mediaType, "text/markdown");
  });

  test("rejects a manifest that is not an object and serializes with a trailing newline", () => {
    assert.throws(() => buildManifest([], { title: "x" }, ["index.html"]), CliError);
    assert.ok(serializeManifest({ a: 1 }).endsWith("}\n"));
  });
});

describe("files", () => {
  test("tells text from binary", () => {
    assert.equal(decodeText(Buffer.from("héllo ✓")), "héllo ✓");
    assert.equal(decodeText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00])), null);
    assert.equal(decodeText(Buffer.from([0xff, 0xfe, 0xfd])), null);
  });

  test("infers media types from extensions", () => {
    assert.equal(inferMediaType("index.HTML"), "text/html");
    assert.equal(inferMediaType("plot.svg"), "image/svg+xml");
    assert.equal(inferMediaType("README"), undefined);
  });

  test("collects a directory's files, skipping dotfiles", () => {
    const path = dir("flat", { "index.html": "<p>hi</p>", "data.json": "{}", ".DS_Store": "x" });
    const files = collectFiles([path]);
    assert.deepEqual([...files.keys()].sort(), ["data.json", "index.html"]);
    assert.equal(files.get("index.html").text, "<p>hi</p>");
  });

  test("rejects sub-directories, duplicate names, empty and reserved files", () => {
    const nested = dir("nested", { "index.html": "x" });
    mkdirSync(join(nested, "assets"));
    assert.throws(() => collectFiles([nested]), /sub-directories \(assets\)/);

    const a = dir("a", { "index.html": "a" });
    const b = dir("b", { "index.html": "b" });
    assert.throws(() => collectFiles([join(a, "index.html"), join(b, "index.html")]), /Two files are named/);

    const empty = dir("empty", { "blank.txt": "" });
    assert.throws(() => collectFiles([empty]), /empty/);

    const reserved = dir("reserved", { "gistfile1.txt": "x" });
    assert.throws(() => collectFiles([reserved]), /automatic Gist file names/);

    assert.throws(() => collectFiles([join(scratch, "missing")]), /No such file/);
  });
});

test("viewerUrls builds the framed and pinned links", () => {
  assert.deepEqual(viewerUrls("https://viewer.example", ID, SHA), {
    viewerUrl: `https://viewer.example/g/${ID}`,
    pinnedUrl: `https://viewer.example/g/${ID}?rev=${SHA}`,
  });
  assert.equal(viewerUrls("https://viewer.example", ID, null).pinnedUrl, null);
});

describe("command line", () => {
  test("prints version and help", () => {
    assert.match(run(["--version"]).stdout, /^\d+\.\d+\.\d+\n$/);
    const help = run(["--help"]);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /publish <file-or-dir>/);
    assert.equal(run([]).status, 0);
  });

  test("reports usage errors with exit code 2", () => {
    const unknown = run(["frobnicate"]);
    assert.equal(unknown.status, EXIT.USAGE);
    assert.match(unknown.stderr, /^error: Unknown command/);
    assert.equal(run(["update"]).status, EXIT.USAGE);
    assert.equal(run(["url", "nope"]).status, EXIT.USAGE);
    assert.equal(run(["url", ID, "--rev", "abc"]).status, EXIT.USAGE);
  });

  test("dry-run publish validates and prints the manifest without a token", () => {
    const path = dir("dry", { "index.html": "<p>hi</p>", "pixel.bin": Buffer.from([0, 1, 2]) });
    const result = run(["publish", path, "--title", "Dry", "--generator", "tests", "--dry-run", "--json"], {
      GIST_ARTIFACTS_TOKEN: "",
      GH_TOKEN: "",
      GITHUB_TOKEN: "",
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.dryRun, true);
    assert.equal(output.manifest.entrypoint, "index.html");
    assert.equal(output.manifest.generator, "tests");
    assert.deepEqual(output.binaryFiles, ["pixel.bin"]);
    assert.ok(output.files.includes(MANIFEST));
  });

  test("refuses --dry-run on a command that would ignore it", () => {
    for (const args of [["reply", ID, "--body", "hello"], ["comments", ID], ["list"]]) {
      const result = run([...args, "--dry-run"], { GIST_ARTIFACTS_TOKEN: "", GH_TOKEN: "", GITHUB_TOKEN: "" });
      assert.equal(result.status, EXIT.USAGE, args.join(" "));
      assert.match(result.stderr, /--dry-run is not available/);
    }
  });

  test("url prints viewer links and honours the viewer setting", () => {
    assert.equal(run(["url", ID], { GIST_ARTIFACTS_VIEWER: "https://v.example/" }).stdout.trim(), `https://v.example/g/${ID}`);
    assert.equal(
      run(["url", ID, "--rev", SHA, "--viewer", "https://w.example"]).stdout.trim(),
      `https://w.example/g/${ID}?rev=${SHA}`,
    );
  });

  test("exits with code 4 when no GitHub token can be found", () => {
    const emptyPath = dir("no-tools", {});
    const result = run(["list"], {
      PATH: emptyPath,
      GIST_ARTIFACTS_TOKEN: "",
      GH_TOKEN: "",
      GITHUB_TOKEN: "",
    });
    assert.equal(result.status, EXIT.AUTH);
    assert.match(result.stderr, /gh auth login -s gist/);
    assert.match(result.stderr, /not installed.*cli\.github\.com/);
  });

  test("names the sign-in command when gh is installed but signed out", () => {
    const bin = dir("signed-out-gh", { gh: "#!/bin/sh\nexit 1\n" });
    chmodSync(join(bin, "gh"), 0o755);
    const result = run(["list"], {
      PATH: `${bin}:${dirname(process.execPath)}`,
      GIST_ARTIFACTS_TOKEN: "",
      GH_TOKEN: "",
      GITHUB_TOKEN: "",
    });
    assert.equal(result.status, EXIT.AUTH);
    assert.match(result.stderr, /^error: Not signed in to GitHub\. Run `gh auth login -s gist`/);
  });

  test("exits with code 4 and names the fix when the sign-in lacks the gist permission", () => {
    // GitHub answers a write from such a sign-in with 404 and the scopes the token does have.
    const preload = join(dir("no-gist-scope", {
      "fetch.mjs":
        'globalThis.fetch = async () => new Response(JSON.stringify({ message: "Not Found" }), ' +
        '{ status: 404, headers: { "content-type": "application/json", "x-oauth-scopes": "repo, read:org" } });\n',
    }), "fetch.mjs");
    const page = dir("no-gist-scope-page", { "index.html": "<p>hi</p>" });
    const bin = dir("signed-in-gh", { gh: "#!/bin/sh\necho not-a-real-token\n" });
    chmodSync(join(bin, "gh"), 0o755);
    const publish = (env) =>
      spawnSync(process.execPath, ["--import", preload, SCRIPT, "publish", page, "--title", "T"], {
        encoding: "utf8",
        env: { ...process.env, GIST_ARTIFACTS_TOKEN: "", GH_TOKEN: "", GITHUB_TOKEN: "", ...env },
      });

    const throughGh = publish({ PATH: `${bin}:${dirname(process.execPath)}` });
    assert.equal(throughGh.status, EXIT.AUTH, throughGh.stderr);
    assert.match(throughGh.stderr, /does not have the gist permission\. Run `gh auth refresh -s gist`\./);

    const throughEnv = publish({ GH_TOKEN: "not-a-real-token" });
    assert.equal(throughEnv.status, EXIT.AUTH, throughEnv.stderr);
    assert.match(throughEnv.stderr, /The token in GH_TOKEN needs the gist scope/);
  });

  test("reads the gist permission from the scopes GitHub reports", () => {
    assert.equal(lacksGistScope("repo, read:org"), true);
    assert.equal(lacksGistScope(""), true);
    assert.equal(lacksGistScope("gist, read:org, repo, workflow"), false);
    assert.equal(lacksGistScope("repo,gist"), false);
    // Tokens that do not report scopes: nothing can be concluded.
    assert.equal(lacksGistScope(null), false);
    assert.equal(lacksGistScope(undefined), false);
  });
});
