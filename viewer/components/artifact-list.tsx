import Link from "next/link"
import { headers } from "next/headers"
import { connection } from "next/server"
import { LayoutGridIcon, LogInIcon, StarIcon, TriangleAlertIcon } from "lucide-react"

import { ArtifactsTable, type ArtifactRow } from "@/components/artifacts-table"
import { OnboardAgentButton } from "@/components/onboard-agent-button"
import { RelativeTime } from "@/components/relative-time"
import { SectionCards, type Stat } from "@/components/section-cards"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { listArtifacts, type ArtifactListing } from "@/lib/artifacts"
import { GitHubError } from "@/lib/github"
import { authConfigured, getSession, toViewer } from "@/lib/session"
import { REPO_URL } from "@/lib/site"
import { appOrigin, artifactUrl, framedUrl } from "@/lib/urls"

type Kind = "mine" | "starred"

function Message({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Empty className="mx-4 my-6 w-auto border lg:mx-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}

function SignInAction({ next }: { next: string }) {
  return (
    <a href={`/api/auth/login?next=${encodeURIComponent(next)}`} className={buttonVariants()}>
      <LogInIcon data-icon="inline-start" />
      Sign in with GitHub
    </a>
  )
}

export function ArtifactListSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6" aria-busy="true" aria-label="Loading artifacts">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  )
}

/** The signed-in person's artifacts, read live from GitHub. Render behind Suspense. */
export async function ArtifactList({ kind }: { kind: Kind }) {
  const path = kind === "mine" ? "/dashboard" : "/dashboard/starred"
  // The list is read live from GitHub for each request.
  await connection()
  const session = await getSession()

  if (!session) {
    if (!authConfigured()) {
      return (
        <Message
          icon={<TriangleAlertIcon />}
          title="Sign-in is not set up on this deployment"
          description={
            <>
              The dashboard needs a GitHub OAuth app. Viewing artifacts by link works without it. See the{" "}
              <a href={`${REPO_URL}#deploy-your-own-viewer`}>setup notes</a>.
            </>
          }
        />
      )
    }
    return (
      <Message
        icon={<LogInIcon />}
        title="Sign in to see your artifacts"
        description="Your artifacts are read live from your GitHub Gists. Nothing is stored on this site."
        action={<SignInAction next={path} />}
      />
    )
  }

  const viewer = toViewer(session)
  let listing: ArtifactListing
  try {
    listing = await listArtifacts(session.token, kind)
  } catch (error) {
    const expired = error instanceof GitHubError && error.status === 401
    return (
      <Message
        icon={<TriangleAlertIcon />}
        title={expired ? "Your GitHub session expired" : "GitHub could not be reached"}
        description={
          expired
            ? "Sign in again to reload your artifacts."
            : error instanceof GitHubError
              ? error.message
              : "Try again in a moment."
        }
        action={expired ? <SignInAction next={path} /> : undefined}
      />
    )
  }

  const app = appOrigin(await headers())
  const rows: ArtifactRow[] = listing.artifacts.map((artifact) => ({
    ...artifact,
    shareUrl: framedUrl(artifact.id, app),
    bareUrl: artifactUrl(artifact.id, app),
  }))

  const notices = (
    <>
      {!viewer.canWrite ? (
        <p className="mx-4 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm lg:mx-6">
          You signed in without the gist permission, so only public Gists are listed and editing is off.{" "}
          <a href={`/api/auth/login?next=${encodeURIComponent(path)}`} className="underline underline-offset-4">
            Grant it
          </a>{" "}
          to see unlisted artifacts.
        </p>
      ) : null}
      {listing.truncated ? (
        <p className="mx-4 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm lg:mx-6">
          Only your {listing.scanned} most recently updated Gists were scanned. Older artifacts are not listed.
        </p>
      ) : null}
    </>
  )

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-4">
        {notices}
        {kind === "mine" ? (
          <Message
            icon={<LayoutGridIcon />}
            title="No artifacts yet"
            description={
              <>
                None of your {listing.scanned} Gists contains an artifact.json. Onboard your agent, then ask
                it to publish a page as a Gist artifact. The <Link href="/#install">install steps</Link> are on
                the home page.
              </>
            }
            action={<OnboardAgentButton size="default" />}
          />
        ) : (
          <Message
            icon={<StarIcon />}
            title="No starred artifacts"
            description="Star an artifact from its details panel to keep it here."
          />
        )}
      </div>
    )
  }

  const publicCount = rows.filter((row) => row.isPublic).length
  const latest = rows[0]
  const stats: Stat[] = [
    {
      label: kind === "mine" ? "Artifacts" : "Starred artifacts",
      value: rows.length,
      hint: `Among ${listing.scanned} Gists`,
    },
    { label: "Public", value: publicCount, hint: "Listed on your GitHub profile" },
    { label: "Unlisted", value: rows.length - publicCount, hint: "Anyone with the link can view" },
    {
      label: "Last updated",
      value: <RelativeTime iso={latest.updatedAt} />,
      hint: latest.title,
    },
  ]

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {notices}
      <SectionCards stats={stats} />
      <ArtifactsTable artifacts={rows} kind={kind} canWrite={viewer.canWrite} />
    </div>
  )
}
