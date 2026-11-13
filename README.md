# Gist Artifacts

Shareable pages from your agent, stored as GitHub Gists.

A **Gist Artifact** is a GitHub Gist that holds a small manifest (`artifact.json`) plus content files: an HTML report, an interactive visualization, a Markdown document. An agent publishes it with one command, a viewer renders it at a shareable link, and every update is a Git revision. The Gist is the only storage; the viewer keeps nothing.

- **Viewer:** https://gist-artifacts.vercel.app
- **Example artifact:** https://gist-artifacts.vercel.app/g/fab233b353d106e591ae37fa12326ba3 (source in [`examples/hello`](examples/hello))
- **Format and design:** [`gist-artifacts-spec.md`](gist-artifacts-spec.md)

This repository contains the three parts of a working prototype:

| Path | What it is |
| --- | --- |
| [`gist-artifacts-spec.md`](gist-artifacts-spec.md) | The open format and the viewer design. |
| [`plugins/gist-artifacts`](plugins/gist-artifacts) | The agent skill and publishing tool, packaged as a plugin for Claude Code and Codex. |
| [`viewer`](viewer) | The viewer: a Next.js application deployed on Vercel. |

## Install the skill in your agent

The skill needs Node.js 18+ and the [GitHub CLI](https://cli.github.com) signed in with the `gist` scope (`gh auth login -s gist`, or `gh auth refresh -s gist`).

**Claude Code** (plugin marketplace):

```text
/plugin marketplace add Eiffl/artifacts
/plugin install gist-artifacts@gist-artifacts
```

Or in one step on Claude Code 2.1.275 or later:

```text
/plugin install gist-artifacts --marketplace Eiffl/artifacts
```

**Codex** (plugin marketplace):

```bash
codex plugin marketplace add Eiffl/artifacts
codex plugin add gist-artifacts@gist-artifacts
```

**Any agent** (skill only, through the [`skills`](https://skills.sh) CLI; it installs for Claude Code, Codex and the other agents it detects):

```bash
npx skills add Eiffl/artifacts
```

**By hand:** copy [`plugins/gist-artifacts/skills/gist-artifacts`](plugins/gist-artifacts/skills/gist-artifacts) into `~/.claude/skills/` (Claude Code) or `~/.agents/skills/` (Codex and others).

Then ask the agent, for example: *"Publish this report as a Gist artifact and give me the link."*

Codex runs commands in a sandbox without network access by default. Approve the publish command when it asks, or allow network access for the workspace.

## What the agent runs

The skill drives one dependency-free script, [`gist-artifacts.mjs`](plugins/gist-artifacts/skills/gist-artifacts/scripts/gist-artifacts.mjs). It can also be used directly:

```bash
alias gist-artifacts='node plugins/gist-artifacts/skills/gist-artifacts/scripts/gist-artifacts.mjs'

gist-artifacts publish ./out --title "Cosmology Explorer" --description "Posterior exploration"
gist-artifacts update <gist> ./out/data.json          # same link, new revision
gist-artifacts update <gist> ./out/index.html --base-revision <sha>   # refuses to overwrite a newer revision
gist-artifacts open <gist> --out ./copy               # read an artifact back
gist-artifacts list                                   # your artifacts
gist-artifacts comments <gist>                        # the Gist's comment thread
gist-artifacts reply <gist> --body "Fixed in the latest revision."
```

Artifacts are unlisted Gists unless `--public` is passed. **Unlisted is not private:** anyone with the link can view the artifact.

Without Node.js the same workflow works with `gh` alone; see [`manual-workflow.md`](plugins/gist-artifacts/skills/gist-artifacts/references/manual-workflow.md).

## The viewer

| URL | Shows |
| --- | --- |
| `/g/<gist-id>` | The artifact in a frame with its title, revision picker, files, history and comments. This is the link to share. |
| `/g/<gist-id>?rev=<sha>` | The same, pinned to one revision. |
| `/a/<gist-id>/` | The artifact on its own page. Sibling files resolve relative to it, always within one revision. |
| `/dashboard` | After signing in with GitHub: your artifacts and your starred ones, read live from your Gists. |

Viewing never needs an account. The viewer reads artifact files straight from GitHub without using API quota, caches them at the CDN, and refreshes immediately when the publishing tool announces a new revision.

### Deploy your own viewer

The viewer is an ordinary Next.js application in [`viewer`](viewer). On Vercel:

1. Import this repository and set the project's **Root Directory** to `viewer`.
2. Set `SESSION_SECRET` (`openssl rand -hex 32`).
3. For sign-in, create a [GitHub OAuth app](https://github.com/settings/developers) whose callback URL is `https://<your-domain>/api/auth/callback`, and set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Without them the viewer still displays artifacts; only the dashboard and write actions are off.
4. Optional: give every artifact its own origin by adding a wildcard domain `*.<your-domain>` to the project and setting `ARTIFACTS_ROOT_DOMAIN=<your-domain>`. Without it, artifacts are served from `/a/<gist-id>/` inside a sandbox, where scripts run but browser storage is unavailable.

Point the publishing tool at your deployment with `GIST_ARTIFACTS_VIEWER=https://<your-domain>`. All settings are described in [`viewer/.env.example`](viewer/.env.example) and [`viewer/README.md`](viewer/README.md).

## Development

```bash
node --test tests/                       # publishing tool (no network)

cd viewer
pnpm install
pnpm dev                                 # http://localhost:3000
pnpm test && pnpm typecheck && pnpm lint
```

Validate the plugin packaging:

```bash
claude plugin validate .                 # Claude Code marketplace and plugin manifests
codex plugin marketplace add "$PWD"      # Codex marketplace, from a local checkout
npx skills add "$PWD" --list             # skill discovery
```

## Status

A prototype. The format is a draft (schema version `0.2`) and may change. There is no access control: do not publish anything confidential.
