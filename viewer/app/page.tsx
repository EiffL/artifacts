import { Suspense } from "react"
import {
  ArrowRightIcon,
  BracesIcon,
  CheckIcon,
  ChevronDownIcon,
  HistoryIcon,
  LinkIcon,
  MessagesSquareIcon,
  PlugIcon,
  UserRoundCheckIcon,
} from "lucide-react"

import { AuthNotice } from "@/components/auth-notice"
import { AuthStatus } from "@/components/auth-status"
import { Command } from "@/components/command"
import { Logo } from "@/components/logo"
import { OpenArtifactForm } from "@/components/open-artifact-form"
import { SiteFooter } from "@/components/site-footer"
import { StarButton } from "@/components/star-button"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { REPO_SLUG, SCHEMA_URL, SPEC_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

const REASONS = [
  {
    icon: UserRoundCheckIcon,
    title: "You own it",
    body: "The artifact is a Gist in your GitHub account. Clone it, fork it, or delete it.",
  },
  {
    icon: LinkIcon,
    title: "One link, always current",
    body: "Updates go to the same Gist, so the link you shared keeps working.",
  },
  {
    icon: HistoryIcon,
    title: "Every version is kept",
    body: "Share the latest version, or a link pinned to one exact revision.",
  },
  {
    icon: MessagesSquareIcon,
    title: "Feedback comes back",
    body: "People comment on the Gist. Your agent reads the thread and replies.",
  },
  {
    icon: PlugIcon,
    title: "Any agent",
    body: "Claude Code, Codex, and other agents that support skills.",
  },
  {
    icon: BracesIcon,
    title: "Open format",
    body: "A four-field manifest, specified in the open and free to implement.",
  },
]

/** Each inner list is one box with its own copy button: slash commands are entered one at a time. */
const INSTALL = [
  {
    id: "claude-code",
    label: "Claude Code",
    commands: [[`/plugin marketplace add ${REPO_SLUG}`], ["/plugin install gist-artifacts@gist-artifacts"]],
  },
  {
    id: "codex",
    label: "Codex",
    commands: [[`codex plugin marketplace add ${REPO_SLUG}`, "codex plugin add gist-artifacts@gist-artifacts"]],
  },
  {
    id: "other",
    label: "Other agents",
    commands: [[`npx skills add ${REPO_SLUG}`]],
  },
]

const ASKS = [
  { say: "Publish this page as a Gist artifact.", get: "A new Gist is created and you get its link." },
  {
    say: "Update the artifact with the new results.",
    get: "A new revision of the same Gist. The link does not change.",
  },
  {
    say: "Give me a link to exactly this version.",
    get: "A link pinned to the current revision, which never changes.",
  },
  { say: "List my artifacts.", get: "Everything you have published, newest first." },
  {
    say: "Someone commented on the artifact. Address it.",
    get: "The agent reads the comments, updates the page, and replies.",
  },
]

const MANIFEST = `{
  "schemaVersion": "0.1",
  "title": "Cosmology Explorer",
  "entrypoint": "index.html",
  "mediaType": "text/html"
}`

const FORMAT_RULES = [
  {
    title: "Files refer to each other by name.",
    body: "A page loads its data and images with plain relative references, always within one revision.",
  },
  {
    title: "The Gist is the identity, and its commits are the versions.",
    body: "The manifest holds no ID, no version number and no URL, so a fork or a clone is still a correct artifact.",
  },
  {
    title: "GitHub provides everything else.",
    body: "Storage, ownership, history, forks, and the comment thread.",
  },
]

const QUESTIONS = [
  {
    q: "Do people need an account to view an artifact?",
    a: "No. Anyone with the link can open it. A GitHub account is only needed to comment or to use the dashboard.",
  },
  {
    q: "Can I make an artifact private?",
    a: "No. An unlisted Gist is hidden from search and from your profile, but there is no access control. Use something else for confidential material.",
  },
  {
    q: "What happens when my agent updates an artifact?",
    a: "It commits to the same Gist. The link shows the new version straight away, and earlier versions stay available through the revision picker or a pinned link.",
  },
  {
    q: "Can I publish without an agent?",
    a: "Yes. The publishing tool is a single script you can run yourself, and an artifact can even be made by hand with the GitHub CLI.",
  },
  {
    q: "Is this viewer guaranteed to stay up?",
    a: "No. It is a prototype with no service commitment. Your artifacts do not depend on it: they are Gists in your account, and the viewer can be self-hosted.",
  },
]

function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {children ? <p className="mt-4 text-lg text-pretty text-muted-foreground">{children}</p> : null}
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-x-5 gap-y-3 sm:grid-cols-[2rem_minmax(0,1fr)]">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full border font-mono text-sm text-muted-foreground"
      >
        {number}
      </span>
      <div className="min-w-0">
        <h2 className="pt-1 font-medium">{title}</h2>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
      </div>
    </li>
  )
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Project and account" className="flex items-center gap-2">
          <StarButton />
          <Suspense fallback={null}>
            <AuthStatus />
          </Suspense>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-14 text-center sm:pt-24">
          <Suspense fallback={null}>
            <AuthNotice />
          </Suspense>
          <h1 className="mx-auto max-w-4xl text-4xl leading-[1.12] font-semibold tracking-tight text-balance sm:text-6xl">
            Shareable pages from your agent, stored in{" "}
            <span className="inline-block rounded-lg bg-(--brand-marker) px-[0.18em] pb-[0.06em] leading-none text-(--brand-on-marker)">
              your own
            </span>{" "}
            GitHub Gists.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">
            Ask your agent for a report, a chart or an interactive page, and get back a link you can send to
            anyone. Every update is a new revision, and nobody needs an account to view it.
          </p>
          <div
            id="install"
            className="mx-auto mt-12 max-w-2xl scroll-mt-8 rounded-2xl border bg-card p-5 text-left shadow-xl shadow-black/5 sm:p-8"
          >
            <ol className="flex flex-col gap-8">
              <Step number={1} title="Install the skill in your agent">
                <Tabs defaultValue={INSTALL[0].id}>
                  <TabsList>
                    {INSTALL.map((option) => (
                      <TabsTrigger key={option.id} value={option.id} className="px-3">
                        {option.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {INSTALL.map((option) => (
                    <TabsContent key={option.id} value={option.id} className="flex flex-col gap-2">
                      {option.commands.map((lines) => (
                        <Command key={lines[0]} label={option.label} lines={lines} />
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </Step>
              <Step number={2} title="Ask for an artifact">
                <p className="rounded-lg border px-3.5 py-3 text-pretty">
                  Publish this report as a Gist artifact and give me the link.
                </p>
                <p className="text-sm text-pretty text-muted-foreground">
                  The agent writes the page, publishes it, and hands you a link.
                </p>
              </Step>
            </ol>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-sm text-pretty text-muted-foreground">
            Publishing uses your sign-in from the{" "}
            <a href="https://cli.github.com" className="underline underline-offset-4 hover:text-foreground">
              GitHub CLI
            </a>
            . If it is missing, your agent gives you the one command to run. Already have a Gist?{" "}
            <a href="#open" className="underline underline-offset-4 hover:text-foreground">
              Open it in the viewer
            </a>
            .
          </p>
        </section>

        <section className="mx-auto mt-28 w-full max-w-6xl px-4 sm:mt-36">
          <SectionHeading title="A page from your agent should be a link.">
            Agents are good at producing pages. Sharing them is the awkward part: a file on your disk is not a
            link, and built-in artifact features keep the page inside one product.
          </SectionHeading>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map((reason) => (
              <li key={reason.title} className="bg-background p-6">
                <reason.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                <h3 className="mt-4 font-medium">{reason.title}</h3>
                <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{reason.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-28 w-full max-w-6xl px-4 sm:mt-36">
          <SectionHeading title="Then keep asking.">
            Changing an artifact updates its Gist, so the link you already shared keeps working.
          </SectionHeading>
          <dl className="mx-auto mt-12 max-w-3xl divide-y border-y">
            {ASKS.map((ask) => (
              <div key={ask.say} className="grid gap-x-8 gap-y-1 py-4 sm:grid-cols-2">
                <dt className="font-medium text-pretty">“{ask.say}”</dt>
                <dd className="text-pretty text-muted-foreground">{ask.get}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto mt-28 w-full max-w-6xl px-4 sm:mt-36">
          <SectionHeading title="A convention, not a service.">
            An artifact is an ordinary GitHub Gist with one extra file, artifact.json, that says what the Gist
            contains. If this viewer disappeared tomorrow, every artifact would still be a complete Gist in its
            owner&apos;s account.
          </SectionHeading>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border">
              <div className="border-b bg-muted/60 px-4 py-2.5 font-mono text-xs text-muted-foreground">
                artifact.json
              </div>
              <pre className="flex-1 overflow-x-auto p-5 font-mono text-sm leading-relaxed">{MANIFEST}</pre>
            </div>
            <div className="flex flex-col justify-between gap-8 rounded-xl border p-6">
              <ul className="flex flex-col gap-5">
                {FORMAT_RULES.map((rule) => (
                  <li key={rule.title} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
                    <CheckIcon className="mt-1 size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="text-pretty">
                      <span className="font-medium">{rule.title}</span>{" "}
                      <span className="text-muted-foreground">{rule.body}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <a href={SPEC_URL} className={buttonVariants({ size: "lg" })}>
                  Read the specification
                </a>
                <a href={SCHEMA_URL} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  JSON Schema
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="open" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-8 px-4 sm:mt-36">
          <div className="rounded-xl border bg-muted/40 px-6 py-12 text-center sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Have a Gist already?</h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
              Paste its URL or ID to open it here. Any Gist with an artifact.json works, whoever published it.
            </p>
            <OpenArtifactForm className="mx-auto mt-7 max-w-md text-left" />
          </div>
        </section>

        <section className="mx-auto mt-28 w-full max-w-6xl px-4 sm:mt-36">
          <SectionHeading title="Good to know." />
          <div className="mx-auto mt-10 max-w-3xl divide-y border-y">
            {QUESTIONS.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDownIcon
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-5 text-pretty text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-28 text-center sm:py-36">
          <h2 className="mx-auto max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
            Ask for a page. Get a link.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            Free and open source. The format, the publishing tool and this viewer are all in one repository.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#install" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-base")}>
              Install the skill
              <ArrowRightIcon data-icon="inline-end" />
            </a>
            <StarButton size="lg" className="h-11 px-5 text-base" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
