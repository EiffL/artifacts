# Gist Artifacts viewer

The reference viewer for [Gist Artifacts](../README.md): a Next.js application that displays artifacts stored in GitHub Gists. It has no database. Everything it shows is read from GitHub.

## How it works

**Serving files** (`app/a/[id]/[[...path]]/route.ts`, `lib/gist-source.ts`). A file request needs three facts, none of which uses GitHub's REST API quota:

1. the Gist's owner, from the redirect of `gist.github.com/<id>`;
2. the current revision, from Git's smart-HTTP ref advertisement (`<id>.git/info/refs`);
3. the bytes, from `gist.githubusercontent.com`, always addressed by commit SHA.

The route re-serves the bytes with a content type inferred from the file extension (GitHub serves HTML and JavaScript as `text/plain`). Non-HTML entrypoints (Markdown, images, text, JSON) get a small wrapper page.

**Two isolation modes** (`proxy.ts`, `lib/config.ts`):

| Mode | When | Artifact URL | Isolation |
| --- | --- | --- | --- |
| Subdomain | `ARTIFACTS_ROOT_DOMAIN` is set | `https://<gist-id>.<root>/` | Each artifact has its own origin; `localStorage` works. |
| Path | otherwise | `https://<app>/a/<gist-id>/` | Responses carry `Content-Security-Policy: sandbox`, giving the page an opaque origin; scripts run, storage does not. |

In subdomain mode the request proxy rewrites every path on an artifact host to the file route, so no page, API route or session cookie is reachable from an artifact's origin.

**Caching.** Pinned URLs (`/@<sha>/…`) are immutable. Current URLs are cached at the CDN for 30 seconds and tagged `gist-<id>`; the current revision is remembered for 30 seconds in the Runtime Cache. `POST /api/revalidate?gist=<id>` re-reads the revision and drops the tagged responses, at most once per revision.

**Framed view** (`app/g/[id]/page.tsx`). Title, revision picker, files, history and comments around a sandboxed iframe. Metadata comes from one REST call per revision, cached; if the API is unavailable the artifact still displays, without history.

**Onboarding from a shared artifact** (`components/frame/frame-footer.tsx`, `app/get-started.md/route.ts`, `lib/onboarding.ts`). A strip under every artifact says what published it and carries an "Onboard your agent" button. The button copies a prompt that tells an agent to fetch `/get-started.md`, a Markdown page with the install commands for each agent. That page asks for the install and nothing else, and says so.

**Social cards** (`app/g/[id]/opengraph-image.tsx`, `lib/artifact-card.tsx`). A shared artifact link unfurls to a generated image with the artifact's title, description and owner, and where to make one. It is cached at the CDN for five minutes under the same `gist-<id>` tag as the files, so republishing refreshes it. The fonts in `assets/fonts` are static cuts of Geist written by the brand build.

**Sign-in and dashboard** (`app/api/auth`, `app/dashboard`, `lib/session.ts`). GitHub OAuth web flow. The access token lives only in an encrypted, HTTP-only, host-only cookie (`__Host-` prefixed in production). The dashboard lists the signed-in person's own and starred Gists that contain `artifact.json`; write actions (`app/actions.ts`) call GitHub with their token.

## Configuration

See [`.env.example`](.env.example). Summary:

| Variable | Needed for |
| --- | --- |
| `SESSION_SECRET` | Sign-in (required in production). |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Sign-in, and a higher API rate limit for framed-view metadata. |
| `GITHUB_TOKEN` | Optional alternative for public API reads. |
| `ARTIFACTS_ROOT_DOMAIN` | Subdomain mode. |
| `NEXT_PUBLIC_REPO_SLUG` | The repository that the landing page, its star button and the sidebar link to. |

The OAuth app's callback URL is `<viewer origin>/api/auth/callback`.

## Local development

```bash
pnpm install
cp .env.example .env.local     # optional: fill in an OAuth app to use the dashboard
pnpm dev
```

- Path mode needs nothing else: open `http://localhost:3000/g/<gist-id>`.
- Subdomain mode: `ARTIFACTS_ROOT_DOMAIN=localhost:3000 pnpm dev`. Browsers resolve `<gist-id>.localhost` without any DNS setup.

```bash
pnpm test        # unit tests (vitest)
pnpm typecheck
pnpm lint
pnpm build
```

Do not run `pnpm build` while `pnpm dev` is using the same checkout; clear `.next` if the development server starts reloading in a loop afterwards.

## Deploying on Vercel

1. Import the repository and set the project's **Root Directory** to `viewer`.
2. Set `SESSION_SECRET` (`openssl rand -hex 32`).
3. For sign-in, create a [GitHub OAuth app](https://github.com/settings/developers) whose callback URL is `https://<your-domain>/api/auth/callback`, and set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Without them the viewer still displays artifacts; only the dashboard and the write actions are off.
4. Optional: for subdomain mode, add `<domain>` and `*.<domain>` to the project (a wildcard needs Vercel's nameservers or a delegated `_acme-challenge` record) and set `ARTIFACTS_ROOT_DOMAIN=<domain>`.

Point the publishing tool at the deployment with `GIST_ARTIFACTS_VIEWER=https://<your-domain>`.
