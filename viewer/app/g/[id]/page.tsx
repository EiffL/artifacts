import { Suspense } from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import type { FrameUrls } from "@/components/frame/frame-header"
import { FrameShell } from "@/components/frame/frame-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { loadArtifactView } from "@/lib/artifacts"
import { isGistId, isSha, rootDomain } from "@/lib/config"
import { loadManifest, resolveHead, resolveOwner } from "@/lib/gist-source"
import { isStarred } from "@/lib/github"
import { authConfigured, getSession, toViewer } from "@/lib/session"
import { SITE_NAME } from "@/lib/site"
import { appOrigin, artifactUrl, framedUrl, gistUrl } from "@/lib/urls"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ rev?: string | string[] }>
}

/** Scripts run; nothing else is granted that would let an artifact act on the viewer's behalf. */
const SANDBOX =
  "allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Titles come from GitHub at request time; never prerender them.
  await connection()
  const id = (await params).id.toLowerCase()
  if (!isGistId(id)) return { title: "Not found" }
  const owner = await resolveOwner(id)
  const head = owner ? await resolveHead(id) : null
  if (!owner || !head) return { title: "Artifact not found" }

  const { manifest } = await loadManifest(owner, id, head)
  const title = manifest?.title ?? "Untitled artifact"
  const description = manifest?.description ?? `A Gist artifact by ${owner}.`
  return {
    title,
    description,
    // Unlisted Gists must stay unlisted.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", siteName: SITE_NAME },
    // The image is this segment's opengraph-image: a card with the title and where it was made.
    twitter: { card: "summary_large_image", title, description },
  }
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <Frame {...props} />
    </Suspense>
  )
}

function FrameSkeleton() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-label="Loading artifact">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-4 w-48" />
        <div className="flex-1" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="size-7" />
      </div>
      <div className="flex-1 bg-muted/30" />
    </div>
  )
}

async function Frame({ params, searchParams }: Props) {
  // Everything below is read from GitHub for this request.
  await connection()
  const [{ id: rawId }, query, headerList, session] = await Promise.all([
    params,
    searchParams,
    headers(),
    getSession(),
  ])
  const id = rawId.toLowerCase()
  if (!isGistId(id)) notFound()

  const requested = typeof query.rev === "string" ? query.rev.toLowerCase() : null
  const rev = isSha(requested) ? requested : null

  const view = await loadArtifactView(id, rev, session?.token)
  if (!view) notFound()

  const viewer = session ? toViewer(session) : null
  const starred =
    session && viewer?.canWrite ? await isStarred(id, session.token).catch(() => false) : false

  const app = appOrigin(headerList)
  const isolated = rootDomain() !== null
  const urls: FrameUrls = {
    share: framedUrl(id, app, rev),
    bare: artifactUrl(id, app, { rev }),
    files: artifactUrl(id, app, { rev: view.revision }),
    gist: gistUrl(id, view.owner),
    signIn: authConfigured()
      ? `/api/auth/login?next=${encodeURIComponent(`/g/${id}${rev ? `?rev=${rev}` : ""}`)}`
      : null,
  }

  return (
    <FrameShell view={view} viewer={viewer} urls={urls} pinned={rev !== null} initiallyStarred={starred}>
      <iframe
        key={urls.bare}
        src={urls.bare}
        title={view.title}
        // In subdomain mode the artifact has an origin of its own and may use it.
        sandbox={isolated ? `${SANDBOX} allow-same-origin` : SANDBOX}
        allow="fullscreen; clipboard-write"
        referrerPolicy="no-referrer"
        className="h-full min-w-0 flex-1 border-0 bg-white"
      />
    </FrameShell>
  )
}
