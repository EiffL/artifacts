import { Suspense } from "react"
import Link from "next/link"
import { GitBranchIcon, PlugIcon, UserRoundCheckIcon } from "lucide-react"

import { AuthNotice } from "@/components/auth-notice"
import { AuthStatus } from "@/components/auth-status"
import { Logo } from "@/components/logo"
import { OpenArtifactForm } from "@/components/open-artifact-form"
import { DEMO_GIST_ID, REPO_SLUG, REPO_URL, SPEC_URL } from "@/lib/site"

const FEATURES = [
  {
    icon: UserRoundCheckIcon,
    title: "Stored in your GitHub account",
    body: "An artifact is a Gist you own: a small manifest plus the files. This viewer keeps no copy and has no database.",
  },
  {
    icon: GitBranchIcon,
    title: "Versioned by Git",
    body: "Every update is a commit. Link to the latest version or pin an exact revision, and fork, clone or comment as on any Gist.",
  },
  {
    icon: PlugIcon,
    title: "Works with any agent",
    body: "The format is open and tiny. Claude Code, Codex and other agents publish with one skill; anyone can run their own viewer.",
  },
]

const INSTALL = [
  {
    label: "Any agent",
    lines: [`npx skills add ${REPO_SLUG}`],
  },
  {
    label: "Claude Code",
    lines: [`/plugin marketplace add ${REPO_SLUG}`, "/plugin install gist-artifacts@gist-artifacts"],
  },
  {
    label: "Codex",
    lines: [`codex plugin marketplace add ${REPO_SLUG}`, "codex plugin add gist-artifacts@gist-artifacts"],
  },
]

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-4 text-sm">
          <a href={SPEC_URL} className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Specification
          </a>
          <a href={REPO_URL} className="text-muted-foreground hover:text-foreground">
            GitHub
          </a>
          <Suspense fallback={null}>
            <AuthStatus />
          </Suspense>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20">
        <section className="mx-auto max-w-2xl pt-16 pb-14 text-center sm:pt-24">
          <Suspense fallback={null}>
            <AuthNotice />
          </Suspense>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Shareable pages from your agent, stored as GitHub Gists
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            An open format for the reports, visualizations and interactive pages an AI agent builds for
            you. Publish once, share a link, keep every revision.
          </p>
          <OpenArtifactForm className="mx-auto mt-8 max-w-md text-left" />
          {DEMO_GIST_ID ? (
            <p className="mt-3 text-sm text-muted-foreground">
              or{" "}
              <Link href={`/g/${DEMO_GIST_ID}`} className="underline underline-offset-4 hover:text-foreground">
                open the example artifact
              </Link>
            </p>
          ) : null}
        </section>

        <section aria-label="How it works" className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border bg-card p-5">
              <feature.icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-3 font-medium">{feature.title}</h2>
              <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight">Publish from your agent</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Install the skill, then ask your agent to publish a page as a Gist artifact. It needs the
            GitHub CLI signed in with the <code className="font-mono text-xs">gist</code> scope.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {INSTALL.map((option) => (
              <div key={option.label} className="flex min-w-0 flex-col rounded-xl border bg-card">
                <h3 className="border-b px-4 py-2.5 text-sm font-medium">{option.label}</h3>
                <pre className="flex-1 overflow-x-auto p-4 font-mono text-xs leading-relaxed">
                  {option.lines.join("\n")}
                </pre>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-muted-foreground">
          <span>Open source. Artifacts live on GitHub, not here.</span>
          <span className="flex gap-4">
            <a href={SPEC_URL} className="hover:text-foreground">
              Specification
            </a>
            <a href={REPO_URL} className="hover:text-foreground">
              Source
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
