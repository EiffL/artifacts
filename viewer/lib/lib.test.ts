import { afterEach, describe, expect, test, vi } from "vitest";

import { gistIdFromHost, isGistId, isSha, isSubdomainOfRoot, parseGistReference, rootDomain } from "./config";
import { formatBytes, formatRelative, shortSha } from "./format";
import { parseHeadFromRefs, rawFileUrl } from "./gist-source";
import { parseManifest } from "./manifest";
import { bareMediaType, contentTypeFor } from "./mime";
import { errorPage, escapeHtml, imagePage, markdownPage, textPage } from "./render";
import { appOrigin, artifactUrl, framedUrl, requestOrigin } from "./urls";

const ID = "b9c4c481ad2dfa225f167fd845f5e7be";
const SHA = "9eabcbcf5f74453ba542b42f8291766f2d4683ac";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config", () => {
  test("recognises Gist IDs and commit SHAs", () => {
    expect(isGistId(ID)).toBe(true);
    expect(isGistId("1234567")).toBe(true);
    expect(isGistId("www")).toBe(false);
    expect(isGistId(ID.toUpperCase())).toBe(false);
    expect(isGistId(undefined)).toBe(false);
    expect(isSha(SHA)).toBe(true);
    expect(isSha(SHA.slice(0, 7))).toBe(false);
  });

  test("path mode: no host is an artifact host", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "");
    expect(rootDomain()).toBeNull();
    expect(gistIdFromHost(`${ID}.viewer.example`)).toBeNull();
    expect(isSubdomainOfRoot(`${ID}.viewer.example`)).toBe(false);
  });

  test("subdomain mode: only <gist-id>.<root> is an artifact host", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "https://Viewer.Example/");
    expect(rootDomain()).toBe("viewer.example");
    expect(gistIdFromHost(`${ID}.viewer.example`)).toBe(ID);
    expect(gistIdFromHost(`${ID.toUpperCase()}.VIEWER.EXAMPLE`)).toBe(ID);
    expect(gistIdFromHost("viewer.example")).toBeNull();
    expect(gistIdFromHost("www.viewer.example")).toBeNull();
    expect(gistIdFromHost(`${ID}.evil.example`)).toBeNull();
    expect(gistIdFromHost(`${ID}.viewer.example.evil.test`)).toBeNull();
    expect(isSubdomainOfRoot("www.viewer.example")).toBe(true);
    expect(isSubdomainOfRoot("viewer.example")).toBe(false);
  });

  test("keeps the port of a local root domain", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "localhost:3000");
    expect(gistIdFromHost(`${ID}.localhost:3000`)).toBe(ID);
    expect(gistIdFromHost(`${ID}.localhost:4000`)).toBeNull();
  });

  test("extracts a Gist ID from pasted references", () => {
    expect(parseGistReference(` ${ID} `)).toBe(ID);
    expect(parseGistReference(`https://gist.github.com/EiffL/${ID}`)).toBe(ID);
    expect(parseGistReference(`https://viewer.example/g/${ID}?rev=${SHA}`)).toBe(ID);
    expect(parseGistReference(`https://gist.githubusercontent.com/EiffL/${ID}/raw/${SHA}/index.html`)).toBe(ID);
    expect(parseGistReference("hello world")).toBeNull();
  });
});

describe("urls", () => {
  test("derives the request origin from forwarded headers", () => {
    expect(requestOrigin(headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(requestOrigin(headers({ host: `${ID}.localhost:3000` }))).toBe(`http://${ID}.localhost:3000`);
    expect(requestOrigin(headers({ host: "viewer.example" }))).toBe("https://viewer.example");
    expect(
      requestOrigin(headers({ host: "internal", "x-forwarded-host": "viewer.example", "x-forwarded-proto": "https" })),
    ).toBe("https://viewer.example");
  });

  test("path mode URLs live under /a/<id>/", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "");
    const app = appOrigin(headers({ host: "viewer.example" }));
    expect(app).toBe("https://viewer.example");
    expect(artifactUrl(ID, app)).toBe(`https://viewer.example/a/${ID}/`);
    expect(artifactUrl(ID, app, { rev: SHA, file: "my notes.txt" })).toBe(
      `https://viewer.example/a/${ID}/@${SHA}/my%20notes.txt`,
    );
    expect(framedUrl(ID, app, SHA)).toBe(`https://viewer.example/g/${ID}?rev=${SHA}`);
  });

  test("subdomain mode URLs use the artifact's own origin", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "viewer.example");
    // Even a request that arrived on an artifact subdomain resolves the application origin.
    const app = appOrigin(headers({ host: `${ID}.viewer.example` }));
    expect(app).toBe("https://viewer.example");
    expect(artifactUrl(ID, app)).toBe(`https://${ID}.viewer.example/`);
    expect(artifactUrl(ID, app, { rev: SHA })).toBe(`https://${ID}.viewer.example/@${SHA}/`);
    expect(framedUrl(ID, app)).toBe(`https://viewer.example/g/${ID}`);
  });
});

describe("mime", () => {
  test("maps extensions to content types", () => {
    expect(contentTypeFor("index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("APP.MJS")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeFor("figure.png")).toBe("image/png");
    expect(contentTypeFor("font.woff2")).toBe("font/woff2");
    expect(contentTypeFor("Makefile")).toBe("application/octet-stream");
    expect(bareMediaType("Text/HTML; charset=utf-8")).toBe("text/html");
  });
});

describe("manifest", () => {
  test("reads a conforming manifest without problems", () => {
    const { manifest, problems } = parseManifest(
      JSON.stringify({
        schemaVersion: "0.1",
        title: "Report",
        entrypoint: "index.html",
        mediaType: "text/html",
        description: "A report",
        future: { ignored: true },
      }),
    );
    expect(problems).toEqual([]);
    expect(manifest).toMatchObject({ title: "Report", entrypoint: "index.html", mediaType: "text/html" });
    expect(manifest).not.toHaveProperty("future");
  });

  test("is lenient about everything except the entrypoint", () => {
    const { manifest, problems } = parseManifest(JSON.stringify({ entrypoint: "notes.md" }));
    expect(manifest).toMatchObject({ title: "notes.md", mediaType: "text/markdown" });
    expect(problems).toEqual(["schemaVersion is missing", "title is missing", "mediaType is missing"]);
  });

  test("rejects unusable manifests", () => {
    expect(parseManifest("{ nope").manifest).toBeNull();
    expect(parseManifest("[]").manifest).toBeNull();
    expect(parseManifest(JSON.stringify({ title: "x" })).problems).toEqual(["artifact.json has no entrypoint"]);
  });
});

describe("gist source", () => {
  test("reads HEAD from a smart-HTTP ref advertisement", () => {
    const advertisement =
      "001e# service=git-upload-pack\n" +
      `00000159${SHA} HEAD\0multi_ack thin-pack symref=HEAD:refs/heads/main agent=git/github\n` +
      `003d${SHA} refs/heads/main\n0000`;
    expect(parseHeadFromRefs(advertisement)).toBe(SHA);
    expect(parseHeadFromRefs("001e# service=git-upload-pack\n0000")).toBeNull();
  });

  test("builds commit-pinned raw URLs with encoded file names", () => {
    expect(rawFileUrl("EiffL", ID, SHA, "my notes #1.txt")).toBe(
      `https://gist.githubusercontent.com/EiffL/${ID}/raw/${SHA}/my%20notes%20%231.txt`,
    );
  });
});

describe("render", () => {
  test("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });

  test("renders Markdown with an escaped source view", () => {
    const page = markdownPage("Notes <1>", "# Hello\n\n<b>bold</b> and `code`");
    expect(page).toContain("<title>Notes &lt;1&gt;</title>");
    expect(page).toContain("<h1>Hello</h1>");
    expect(page).toContain("<code>code</code>");
    expect(page).toContain('<pre class="source"># Hello\n\n&lt;b&gt;bold&lt;/b&gt;');
  });

  test("pretty-prints JSON and escapes text previews", () => {
    expect(textPage("data", '{"a":[1,2]}', true)).toContain('{\n  &quot;a&quot;: [\n    1,\n    2\n  ]\n}');
    expect(textPage("data", "{ not json <", true)).toContain("{ not json &lt;");
    expect(textPage("log", "<script>alert(1)</script>", false)).not.toContain("<script>alert(1)");
  });

  test("image and error pages escape their inputs", () => {
    expect(imagePage('A "plot"', "plot%20a.svg")).toContain('<img src="plot%20a.svg" alt="A &quot;plot&quot;">');
    const page = errorPage(404, "File <x> not found", "detail & more", "https://viewer.example");
    expect(page).toContain("File &lt;x&gt; not found");
    expect(page).toContain("detail &amp; more");
    expect(page).toContain('href="https://viewer.example"');
  });
});

describe("format", () => {
  test("formats sizes, revisions and relative times", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 kB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(shortSha(SHA)).toBe("9eabcbc");
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(formatRelative("2026-11-13T11:59:50Z", now)).toBe("just now");
    expect(formatRelative("2026-11-13T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelative("2026-11-12T12:00:00Z", now)).toBe("yesterday");
  });
});
