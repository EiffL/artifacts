# Contributing

## What is in this repository

| Path | What it is |
| --- | --- |
| [`gist-artifacts-spec.md`](gist-artifacts-spec.md), [`schemas`](schemas) | The format specification and its JSON Schema. |
| [`plugins/gist-artifacts`](plugins/gist-artifacts) | The skill and the publishing tool, packaged as a plugin for Claude Code and Codex. |
| [`viewer`](viewer) | The viewer, a Next.js application deployed on Vercel. See [`viewer/README.md`](viewer/README.md). |
| [`examples/hello`](examples/hello) | The source of the example artifact. |
| [`brand`](brand) | The logo, colours, fonts and brand guide, and the scripts that generate them. See [`brand/README.md`](brand/README.md). |
| [`tests`](tests) | Tests for the publishing tool, and for the consistency of the specification, the schema and the tool. |

## The publishing tool

The skill drives one dependency-free script, [`gist-artifacts.mjs`](plugins/gist-artifacts/skills/gist-artifacts/scripts/gist-artifacts.mjs). It needs Node.js 18 or later and a GitHub token with the `gist` scope, which it takes from `GIST_ARTIFACTS_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` or `gh auth token`. It can be used directly:

```bash
alias gist-artifacts='node plugins/gist-artifacts/skills/gist-artifacts/scripts/gist-artifacts.mjs'

gist-artifacts publish ./out --title "Cosmology Explorer" --description "Posterior exploration"
gist-artifacts update <gist> ./out/data.json                          # same link, new revision
gist-artifacts update <gist> ./out/index.html --base-revision <sha>   # refuses to overwrite a newer revision
gist-artifacts open <gist> --out ./copy                               # read an artifact back
gist-artifacts list                                                   # your artifacts
gist-artifacts comments <gist>                                        # the Gist's comment thread
gist-artifacts reply <gist> --body "Fixed in the latest revision."
```

Run it with `--help` for every option. Set `GIST_ARTIFACTS_VIEWER` to make it print links to a different viewer.

Without Node.js the same workflow works with `gh` alone: see [`manual-workflow.md`](plugins/gist-artifacts/skills/gist-artifacts/references/manual-workflow.md).

## Tests

```bash
node --test tests/          # publishing tool and specification; no network needed

cd viewer
pnpm install
pnpm test && pnpm typecheck && pnpm lint
```

`tests/spec.test.mjs` checks that every link and JSON example in the specification is valid, that the examples agree with the JSON Schema, and that the tool writes manifests the schema accepts. A change to the format has to keep all three in step.

## Plugin packaging

The same skill directory is distributed through a Claude Code marketplace (`.claude-plugin/marketplace.json`), a Codex marketplace (`.agents/plugins/marketplace.json`) and the `skills` CLI. To check the packaging from a local checkout:

```bash
claude plugin validate .                 # Claude Code marketplace and plugin manifests
codex plugin marketplace add "$PWD"      # Codex marketplace
npx skills add "$PWD" --list             # skill discovery
```

The Claude Code manifest has no `version` on purpose, so installed copies follow commits. The Codex manifest has one: bump it when the skill changes.

## Brand

Everything under `brand` except its `tools`, `tokens/colors.json` and `fonts` is generated, and so are the copies the rest of the repository uses: the viewer's icons, social image, `app/brand.css`, `lib/brand.json` and `assets/fonts`, the plugin's `assets`, and `examples/hello/logo.png`. Edit the sources and rebuild instead of editing those files:

```bash
cd brand
just build   # needs uv, rsvg-convert, ImageMagick and Chromium
just check   # brand rules, contrast, and that every copy is up to date
```

The viewer takes all its colours from `app/brand.css`, so a change to `brand/tokens/colors.json` reaches the interface on the next build. Its logo component is written by hand; `just check` fails if it stops matching the compact mark.

## Viewer

Local development, configuration and deployment are described in [`viewer/README.md`](viewer/README.md).
