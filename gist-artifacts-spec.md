# Gist Artifacts — Minimal Specification (Draft v0.2)

**Status:** Exploratory proposal, 13 November 2026. Not an implemented standard.

**Changes since v0.1:** multi-file artifacts with relative references and binary assets; a concrete viewer design with one origin per artifact, with an open-source reference implementation on Vercel that includes GitHub sign-in and a dashboard; an explicit dependency policy; data files as agent-writable state; comments via Gist comments; conflict detection and listing in the publishing contract; an agent-integration section; security requirements reduced to a single rule.

## 1. Principle

A **Gist Artifact** is a portable, versioned collection of files that an agent or human publishes as one GitHub Gist. A small manifest tells any compatible viewer what the collection is and how to display it. GitHub supplies storage, identity, revision history, comments, forks, and sharing links; viewers supply rendering. The format is not coupled to any AI model, agent, chat application, or particular viewer.

The primary use case is a standalone document, visualization, or interactive HTML page created during an AI conversation, which can subsequently be revisited, updated, forked, commented on, and shared.

The proposal has two layers with different rules. The **format** (manifest, file layout, revisions, comments) lives entirely in GitHub Gists and is open: nothing about an artifact is stored anywhere else. The **viewer** is replaceable display infrastructure that holds no artifact data; it may be built for a specific hosting provider, and the reference implementation (§4.4) targets Vercel and is open source. Losing or replacing a viewer loses no content.

The design target is rough parity with vendor-hosted HTML artifacts for everything that does not need access control or a server-side runtime, while keeping what a Git primitive gives for free: real revision history, forks, clones, and offline copies.

## 2. File layout

Each conforming Gist MUST contain a file named `artifact.json` and at least one content file. A Gist is a flat collection of named files; nested directories are not available.

Example:

```text
artifact.json
index.html
data.json
figure1.png
```

`artifact.json`:

```json
{
  "schemaVersion": "0.2",
  "title": "Cosmology Explorer",
  "entrypoint": "index.html",
  "mediaType": "text/html",
  "description": "Interactive exploration of a parameter posterior",
  "icon": "chart",
  "generator": "claude-code",
  "source": "https://github.com/example/analysis/commit/4c98629"
}
```

Required properties:

| Property | Meaning |
| --- | --- |
| `schemaVersion` | Manifest format version; currently `"0.2"`. |
| `title` | Human-readable artifact title. |
| `entrypoint` | Exact name of a file present in the same Gist. |
| `mediaType` | MIME type of the entrypoint, e.g. `text/html`, `text/markdown`, `image/svg+xml`, `text/plain`, or `application/json`. |

Optional properties:

| Property | Meaning |
| --- | --- |
| `description` | One-sentence summary, shown in listings. |
| `icon` | One generic word (`chart`, `map`, `notes`) a viewer may map to a tab or listing icon. |
| `generator` | Free-form name of the tool or agent that produced the artifact. |
| `source` | URL of the code, commit, or dataset the artifact was produced from. |

Unknown properties MUST be ignored by readers, preserving forward compatibility.

The manifest MUST be valid UTF-8 JSON and MUST NOT carry passwords, access tokens, or other secrets. The Gist description SHOULD be set to the artifact title, so that GitHub's own listing stays readable and a dashboard can list artifacts without fetching each manifest (§4.5).

### 2.1 Relative references and assets

An HTML entrypoint MAY reference any other file in the same Gist by its bare name (`figure1.png`, `./data.json`, `style.css`). A viewer MUST resolve such references to the file of that name **at the same revision as the entrypoint**, served with a content type inferred from the file extension.

Binary files (images, fonts, PDFs) are permitted. The Gist REST API only writes text, so binaries are added by pushing to the Gist's Git repository (§5).

Individual files SHOULD stay under 10 MB. Larger files still work but cannot be cached by the reference viewer's CDN (§4.4) and are better hosted elsewhere and referenced by URL.

### 2.2 Data files as state

Authors SHOULD keep data that changes separately from the page that displays it: the page fetches `./data.json` (or CSV, etc.) at load time, and an agent later updates only that file. Each update is an ordinary revision, so the state is versioned and diffable, and the page code is untouched. A page MAY re-fetch its data file periodically to pick up updates without a reload.

This covers trackers, logs, dashboards, and result tables that an agent maintains. State written by *viewers* (polls, sign-up sheets) is not provided by the format; see §7.

Per-viewer state (a remembered tab, a filter, a draft) belongs in `localStorage`, which works because each artifact has its own origin (§4.1).

## 3. Identity and revisions

- **Artifact identity:** the GitHub Gist ID. The original Gist URL is the canonical source link.
- **Current version:** the current Gist state at the time of reading.
- **Immutable revision:** a Git commit SHA in that Gist's revision history. A multi-file update SHOULD be a single commit so that no revision is ever half-updated.
- **Update:** edit files in the existing Gist; do not create another Gist merely to update an artifact.
- **Fork:** a GitHub Gist fork, with a new identity. GitHub records the parent (`fork_of`), so provenance needs no manifest field.
- **Export:** `git clone` of the Gist, or GitHub's ZIP download. Because references are relative, a clone opens locally and can be moved to any Git repository or static host unchanged.

The manifest intentionally contains no Gist ID, revision SHA, or storage URL: these belong to the storage layer and would become stale on forks or exports.

## 4. Rendering contract

1. A viewer retrieves the specified Gist (current, or at a given revision) and parses `artifact.json`.
2. It validates the entrypoint's presence and chooses a renderer using `mediaType`.
3. It displays the content without modifying the source Gist.
4. It provides a link to the original Gist and SHOULD expose source, revision history, and comments.

Renderers:

| MIME type | Display |
| --- | --- |
| `text/html` | The page itself, scripts enabled, in the artifact's own origin. |
| `text/markdown` | Rendered document with source toggle. |
| `image/svg+xml` | Displayed as an image. |
| `text/plain`, `application/json` | Text/code preview. |

Raw JSX/TSX compilation is not part of the specification; compiled output can be published as ordinary files.

### 4.1 Viewer URL scheme

The recommended viewer is a single small proxy service behind a wildcard domain, with no database. A proxy is required, not optional: GitHub serves raw Gist HTML and JavaScript as `text/plain` with `nosniff` and a sandboxing CSP, so browsers will not run them directly from GitHub.

```text
https://<gist-id>.viewer.example/               entrypoint, current revision
https://<gist-id>.viewer.example/<file>         any file, current revision
https://<gist-id>.viewer.example/@<sha>/        entrypoint, pinned revision
https://<gist-id>.viewer.example/@<sha>/<file>  any file, pinned revision
https://viewer.example/g/<gist-id>[?rev=<sha>]  framed view: title bar, source,
                                                history and comments links
```

For each request the service looks up the Gist (at `<sha>` if given), finds the named file, fetches its raw content, and returns it with a content type inferred from the extension. Gist file names cannot contain `/`, so the `@<sha>/` prefix never collides with a file. Properties that follow from this shape:

- **Relative references work unmodified**, and under `/@<sha>/` every sub-resource resolves to the same revision, so revisions never mix.
- **One origin per artifact.** `localStorage` and similar APIs work and cannot collide between artifacts, and artifact scripts never run in an origin that holds viewer or GitHub credentials.
- **Caching is trivial.** Pinned responses are immutable and can be cached indefinitely; current-revision responses get a short TTL (about a minute), which is also the delay before an update becomes visible.
- **Size and rate limits are handled server-side.** The service reads raw file URLs, which avoids the API's 1 MiB content truncation, and can authenticate its API calls with one token.

The link an agent hands to a person is the framed view; the bare subdomain is what the frame embeds and what a person opens for a full-page view.

A zero-infrastructure fallback is a static single-origin viewer in the style of GistPreview or Gist Host, which fetches the Gist client-side and rewrites relative references to blob URLs. It needs no server, but all artifacts share one origin (authors should then prefix `localStorage` keys) and every visitor spends their own unauthenticated API quota.

### 4.2 Dependencies and network access

Pages MAY load external scripts, styles, and fonts, and MAY make network requests to any service. Two rules keep artifacts reproducible:

- An external script or stylesheet URL MUST name an exact version (`d3@7.9.0`, never `d3` or `d3@7`).
- Authors SHOULD prefer the large public CDNs (cdnjs, jsDelivr, unpkg, Google Fonts) and SHOULD inline anything small.

A page that must work offline or be archived SHOULD be fully self-contained.

### 4.3 Security

Secret Gists are unlisted, not private: possession of the URL grants access. This is the accepted sharing model. There is no access control, and artifacts should not contain anything that must stay confidential.

The single requirement on viewers is that artifact content MUST NOT execute in an origin that holds credentials (viewer sessions, GitHub tokens). The per-artifact origin of §4.1 satisfies this by construction.

### 4.4 Reference implementation on Vercel

The reference viewer is one open-source Vercel project: a Next.js application whose route handlers serve artifact files and whose pages provide the framed view and a signed-in dashboard (§4.5), with the Vercel CDN in front. It has no database and no build-time knowledge of any artifact. Anyone can deploy their own copy against their own domain; artifacts are not tied to a particular deployment.

**Domains.** The project is assigned `viewer.example` and the wildcard `*.viewer.example`. Vercel supports wildcard domains on all plans, with automatic certificates, provided it can answer the DNS challenge: either the domain uses Vercel's nameservers, or the `_acme-challenge` subdomain is delegated to Vercel while DNS stays with the existing provider. A dedicated domain (or a dedicated sub-zone such as `*.artifacts.example.org`) keeps artifact origins apart from any other site.

**Request handling.** The application's request proxy (Next.js middleware) branches on the `Host` header and rewrites artifact subdomains to an internal file-serving route:

1. *Apex host* serves the framed view `/g/<gist-id>`, the dashboard, sign-in, the revalidation endpoint, and a landing page.
2. *`<gist-id>` subdomain* (32 hexadecimal characters) serves artifact files:
   1. Parse the path into an optional `@<sha>/` prefix and a file name; an empty name means the manifest's `entrypoint`.
   2. Load the Gist metadata with `GET /gists/{id}` or `GET /gists/{id}/{sha}`, authenticated with one server-side GitHub token held in an environment variable. The response lists every file with a `raw_url` that is pinned to that file's content, and includes the content of files up to 1 MiB inline (base64 for binary files).
   3. Serve the file: from the inline content when present, otherwise by streaming the `raw_url` body. Streaming matters because non-streamed function responses are capped at 4.5 MB.
   4. Set `Content-Type` from the file extension, drop GitHub's own `Content-Security-Policy` and `text/plain` typing, and add `Access-Control-Allow-Origin: *`.
   5. For a non-HTML `mediaType`, the root URL returns a small wrapper page that renders the entrypoint (Markdown, SVG, text); the file itself stays available at `/<file>`.

**Caching.** Two layers, both keyed per artifact because the CDN cache key includes the host:

| Request | Browser | Vercel CDN |
| --- | --- | --- |
| Pinned (`/@<sha>/…`) | `Cache-Control: public, max-age=31536000, immutable` | Same; never revalidated |
| Current | `Cache-Control: public, max-age=0, must-revalidate` | `Vercel-CDN-Cache-Control: max-age=60, stale-while-revalidate=600`, tagged `Vercel-Cache-Tag: gist-<gist-id>` |

Gist metadata is additionally kept in Vercel's Runtime Cache (60 seconds for current, indefinitely for a pinned revision), so the many file requests of one page load cost a single GitHub API call.

**Instant updates.** Gists have no webhooks, so the viewer cannot be told about a change by GitHub. Instead the publishing tool calls `POST https://viewer.example/api/revalidate?gist=<gist-id>` after every `publish` or `update`. The endpoint checks the Gist's current revision against the cached one and, if it changed, invalidates the `gist-<gist-id>` cache tag. It needs no authentication because it can only cause a refresh of content that really changed. Without the call, an update appears within about a minute.

**Framed view.** `viewer.example/g/<gist-id>` is a server-rendered shell around an iframe of the artifact's subdomain. It shows the title, description, owner and last update from the manifest and Gist metadata; a revision picker built from the Gist's `history`; and links to the source Gist, its comment thread (with count) and the fork action. It also emits Open Graph tags from the manifest so shared links unfurl with a title and description.

**Limits that shape the design.**

- The CDN caches function responses up to 10 MB; larger files are served but hit the function every time (hence the guidance in §2.1).
- CDN and Runtime Cache entries are per region and best-effort, so a rarely viewed artifact costs one GitHub API call per region on its first view. An authenticated token allows 5,000 API calls per hour, which the two cache layers keep far out of reach for ordinary traffic.
- Wildcard domains apply to the production deployment. Local development uses `<gist-id>.localhost`, which browsers resolve without configuration.
- Vercel's Hobby plan is limited to non-commercial use; an organisation running a shared viewer would use a paid plan.

**Repository layout (indicative).**

```text
proxy.ts                      host routing: <gist-id> subdomain -> /_artifact/<gist-id>/...
app/_artifact/[id]/[[...path]]/route.ts   file serving, wrapper pages
app/g/[id]/page.tsx           framed view
app/(dashboard)/              signed-in dashboard (§4.5)
app/api/revalidate/route.ts   cache-tag invalidation
app/api/auth/                 GitHub sign-in
lib/gist.ts                   GitHub client, metadata cache, revision resolution
lib/mime.ts                   extension to content-type table
components/ui/                shadcn/ui components
```

Nothing in the format depends on Vercel. The same service fits any platform that offers wildcard subdomains, a function runtime, and an HTTP cache.

### 4.5 Sign-in and dashboard

Viewing an artifact never requires an account. Signing in with GitHub adds a personal dashboard for browsing and managing one's own artifacts, the equivalent of a vendor's artifact gallery. It stays within the no-database rule: everything shown is read live from the GitHub API with the signed-in person's own token.

**Authentication.** Standard GitHub OAuth sign-in (for example Auth.js with its GitHub provider and stateless sessions). The GitHub access token is kept only in an encrypted, HTTP-only session cookie; nothing is stored server-side.

- The session cookie is host-only on the apex domain and uses the `__Host-` name prefix, so it is never sent to artifact subdomains and artifact scripts cannot overwrite it. This is what keeps §4.3's single rule true once the service holds credentials.
- Sign-in asks for the `gist` scope, which is needed to list secret Gists and to perform the write actions below. A person who declines it can still sign in with no scope and see their public artifacts only.

**Dashboard.** Built on the shadcn/ui dashboard block (sidebar, cards, data table), on the apex host:

| View | Content | Source |
| --- | --- | --- |
| My artifacts | Table of the person's artifacts: title, description, visibility, last update, file and comment counts; search, sort, filter | `GET /gists`, filtered to Gists containing `artifact.json` |
| Starred | Artifacts the person starred, as a "saved" or "shared with me" shelf | `GET /gists/starred`, same filter |
| Artifact detail | The framed view plus file list, revision history with per-revision links, comment thread, and forks | `GET /gists/{id}`, `/commits`, `/comments`, `/forks` |

The list response includes file names and the Gist description but not file contents, which is why §2 asks for the description to equal the title: the table renders from one paginated call, without fetching each manifest.

**Actions**, all direct GitHub API calls with the person's token: copy the share link or a pinned-revision link, star or unstar, fork, post a comment from the framed view, edit title and description (rewrites `artifact.json` and the Gist description in one revision), and delete (with confirmation).

Because the dashboard is only a view over GitHub, an artifact published by any tool appears in it immediately, and nothing is lost if a person never signs in or the service disappears.

## 5. Publishing contract

An agent-facing implementation provides these operations:

```text
publish(files, manifest, visibility)       -> { gistId, revision, sourceUrl, viewerUrl }
update(gistId, files, baseRevision?)       -> { gistId, revision, viewerUrl }
open(gistId, revision?)                    -> { manifest, files, revision }
list()                                     -> [ { gistId, title, description, updatedAt } ]
comments(gistId)                           -> [ { id, author, body, createdAt } ]
reply(gistId, body)                        -> { id }
```

These are conceptual operations, not a specified network API.

- **`update` is partial.** Files passed are added or replaced, files omitted are kept, and a file passed as `null` is removed. The manifest is an ordinary file in this map.
- **Conflict detection.** If `baseRevision` is given and is not the Gist's current revision, `update` MUST fail and return the current revision so the caller can merge. Implemented over Git this is free: a push that is not a fast-forward is rejected.
- **`list`** returns the owner's Gists that contain an `artifact.json`. GitHub's Gist listing includes file names, so this is a filter over one paginated call, not a registry.
- **`comments` / `reply`** map directly to Gist comments (§6).
- **Viewer notification.** After a successful `publish` or `update`, the implementation SHOULD notify the configured viewer so the change is visible immediately (§4.4). The viewer base URL is configuration of the publishing tool, never part of the artifact.

Implementations can use the GitHub Gist REST API, `gh`, or Git. Git (`https://gist.github.com/<gist-id>.git`) is the most general write path: it handles binary files, makes a multi-file update one commit, and provides conflict detection. Writes require authorization from the Gist owner.

### 5.1 Agent integration

No dedicated server is needed where the agent has a shell. The suggested packaging is a **skill plus one helper script**:

- The skill carries this contract and the authoring guidance of §5.2.
- The script implements the six operations over `gh`/`git`, validates the manifest (entrypoint exists, media type matches), and prints the viewer URL and pinned revision.

An **MCP server** exposing the same six operations is only needed for agents without shell access (chat surfaces, hosted agents). It would be a remote server using GitHub OAuth with the `gist` scope; it adds reach, not capability.

### 5.2 Authoring guidance

Agents producing HTML artifacts SHOULD:

- give the page a short `<title>` matching the manifest title;
- support light and dark themes via `prefers-color-scheme`, with an explicit body background;
- lay out correctly at phone width without horizontal scrolling;
- wrap `localStorage` access in `try`/`catch` and render correctly without it;
- keep changing data in data files (§2.2) rather than in the page source.

## 6. Comments and feedback

A Gist's native comment thread is the artifact's comment thread. Viewers SHOULD link to it or display it. Agents read feedback with `comments` and answer with `reply`; a person asking for a change in a comment and an agent answering with a new revision plus a reply is the intended review loop.

Comments are per-artifact, not anchored to a location in the page. A commenter can quote the passage they mean using Markdown quoting. Commenting requires a GitHub account.

## 7. Non-goals

- No access control or private sharing beyond unlisted links.
- No viewer-writable shared state, databases, or server-side code. A page that needs them can call its own backend (§4.2 permits this).
- No conversation or agent-identity schema beyond the optional `generator` and `source` fields.
- No search service or registry: `list` and the dashboard (§4.5) only show a person's own and starred Gists, read live from GitHub.
- No required build tool, dependency installation, JSX compilation, or framework.
- No mandated hosted viewer service (the Vercel implementation of §4.4 is a reference, not a requirement), and no guarantee of long-term preservation independent of GitHub (a clone is the preservation path).

Candidate extensions for a later revision: **templates** (a manifest field naming another Gist Artifact whose page renders this artifact's data files, giving reusable slide, document, and dashboard types), anchored comments, and content hashes.

## 8. Existing work and positioning (research snapshot)

This is a proposal for interoperability, **not a claim of inventing Gist-hosted HTML artifacts**.

Closest direct precedents:

- [GistPreview](https://github.com/gistpreview/gistpreview.github.io) renders a Gist's `index.html` (or a selected file) as HTML.
- [Gist Host](https://simonwillison.net/2026/Jan/1/gisthost/) by Simon Willison updates that pattern. Willison's `claude-code-transcripts --gist` already publishes AI-related HTML output and returns a live Gist Host URL.

Related agent artifact products:

- [Open Artifacts](https://github.com/open-artifacts-ai/open-artifacts): provider-independent publication, versions, viewing, sharing, MCP, and live data; uses Cloudflare rather than Gists.
- [Artifact Server](https://github.com/plannotator/artifact-server): self-hostable, MCP/agent-skill integration, revision and review workflows; not Gist-backed.
- [AgentUse Artifacts](https://github.com/agentuse/artifacts): local-first feed of agent outputs and revision snapshots.
- [coda0HQ/open-artifacts](https://github.com/coda0HQ/open-artifacts): versioned HTML/Markdown publication with a recipe/manifest approach; Cloudflare-based.

**Distinctive scope:** a *tiny, declarative manifest layered on an existing Git primitive*, with an independently implementable viewer. GistPreview/Gist Host already demonstrate the viewer half; agent artifact servers demonstrate the agent workflow half. The value of this proposal would be an interoperable contract connecting the two, not a new hosting platform.

### Comparison with vendor-hosted artifacts

| Capability | Vendor-hosted (e.g. Claude artifacts) | Gist Artifacts v0.2 |
| --- | --- | --- |
| Interactive HTML page, updated in place | Yes | Yes |
| Multi-file and binary assets | Yes | Yes (§2.1) |
| Per-artifact origin, working `localStorage` | Yes | Yes (§4.1) |
| Revision history | Yes | Yes, as Git commits; forkable and clonable |
| Conflict detection on update | Yes | Yes (§5) |
| Agent-maintained data behind a page | Yes (managed database) | Yes (data files, §2.2) |
| Comments reaching the agent | Yes, anchored | Yes, unanchored (§6) |
| Listing of one's artifacts | Yes (gallery) | Yes (`list`, and the dashboard of §4.5) |
| External libraries and network access | Restricted allowlist | Open, version-pinned (§4.2) |
| Offline copy, export, self-hosting | No | Yes |
| Works with any agent or viewer | No | Yes |
| Private sharing with per-person access | Yes | No |
| Viewer-written shared state, viewer identity | Yes | No |
| Page calling a model or connected data sources | Yes | No (bring your own backend) |
| Ready-made types (slides, documents, dashboards) | Yes | No (templates are a candidate extension) |

## 9. Engineering constraints to validate in a prototype

Checked on 13 November 2026 against live public Gists and the current Vercel documentation:

- Gist IDs are 32 hexadecimal characters, so they are valid DNS labels.
- `GET /gists/{id}` returns, per file, a content type, size, a `truncated` flag, inline content (base64 for binary files such as PNG), and a `raw_url` containing a per-file content hash. It also returns the revision `history` and the comment count.
- `GET /gists/{id}/{sha}` returns the file set of that revision in the same shape.
- Raw Gist URLs serve images with their real content type, but HTML and JavaScript as `text/plain` with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: … sandbox`. They send `Access-Control-Allow-Origin: *`. Raw responses carry `max-age=300` and API responses `max-age=60`.
- Binary files do exist in Gists in practice (the sampled Gist held PNG files).
- The Gist's current revision can be read without the REST API via `git ls-remote https://gist.github.com/<id>.git`.
- Vercel: wildcard domains on all plans with the nameserver or `_acme-challenge` requirement; 4.5 MB function response limit that does not apply to streamed responses; 10 MB maximum cacheable response; host included in the CDN cache key; tag-based invalidation through `Vercel-Cache-Tag`, available on all plans.

Still to validate:

- Unauthenticated conditional requests (`If-None-Match`) returned `304` but still consumed rate-limit quota in testing; confirm whether authenticated ones are free, which would make revalidation nearly costless.
- The exact host-based rewrite in the Next.js request proxy (file name and API differ between Next.js versions), that CDN caching still applies to the rewritten route, and the runtime call used to invalidate a cache tag from inside a function.
- GitHub sign-in scopes: whether a narrower grant than the OAuth `gist` scope (which includes write access) can list a person's secret Gists, for example a GitHub App with a read-only Gists permission.
- That a signed-in person's `GET /gists` listing is complete enough for the dashboard (pagination, the 300-file cap per Gist) and how it performs for accounts with thousands of Gists.
- Behaviour of streamed responses with the CDN cache for files between 4.5 MB and 10 MB.
- Pushing binary files over Git to a Gist end to end, and practical size limits (files over 10 MiB reportedly require a clone to read).
- Whether inline API content is reliable enough to serve directly, or whether the viewer should always read `raw_url`.
- The real delay between an update and the current-revision URL reflecting it, with and without the revalidation call.
- `gh` token scopes and the exact `gh`/`git` invocations for each operation in §5 across platforms.

## 10. References

- GitHub REST Gists: https://docs.github.com/en/rest/gists/gists
- GitHub REST Gist comments: https://docs.github.com/en/rest/gists/comments
- Gist API file truncation: https://github.com/github/docs/blob/main/content/rest/gists/gists.md
- Vercel wildcard domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain
- Vercel multi-tenant limits: https://vercel.com/docs/platforms/multi-tenant-platforms/limits
- Vercel Functions limits: https://vercel.com/docs/functions/limitations
- Vercel CDN cache: https://vercel.com/docs/caching/cdn-cache
- Vercel cache purging and tags: https://vercel.com/docs/caching/cdn-cache/purge
- GistPreview: https://github.com/gistpreview/gistpreview.github.io
- Simon Willison, Gist Host: https://simonwillison.net/2026/Jan/1/gisthost/
- Open Artifacts: https://open-artifacts.com/docs/mcp-tools/
- Artifact Server: https://github.com/plannotator/artifact-server
- AgentUse Artifacts: https://github.com/agentuse/artifacts
