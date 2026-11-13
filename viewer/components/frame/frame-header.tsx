"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ExternalLinkIcon,
  GitForkIcon,
  GlobeIcon,
  InfoIcon,
  LockIcon,
  MessageSquareIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { forkArtifact, starArtifact } from "@/app/actions"
import {
  DeleteArtifactDialog,
  EditDetailsDialog,
  type DialogTarget,
} from "@/components/artifact-dialogs"
import { CopyButton } from "@/components/copy-button"
import { LogoMark } from "@/components/logo"
import { RelativeTime } from "@/components/relative-time"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ArtifactView } from "@/lib/artifacts"
import { formatBytes, formatDateTime, shortSha } from "@/lib/format"
import type { Viewer } from "@/lib/session"
import { cn } from "@/lib/utils"

export type FrameUrls = {
  /** Shareable framed link for what is being shown (pinned when a revision is selected). */
  share: string
  /** The artifact on its own, without this frame. */
  bare: string
  /** Base URL of the shown revision's files; ends with a slash. */
  files: string
  gist: string
  signIn: string | null
}

const LATEST = "latest"

function RevisionSelect({ view, pinned }: { view: ArtifactView; pinned: boolean }) {
  const router = useRouter()
  if (view.history.length === 0) return null

  const items = [
    { value: LATEST, label: "Latest" },
    ...view.history.map((entry) => ({
      value: entry.version,
      label: `${shortSha(entry.version)} · ${formatDateTime(entry.committedAt)}`,
    })),
  ]
  // A pinned revision that is no longer in the listed history still needs a label.
  if (pinned && !view.history.some((entry) => entry.version === view.revision)) {
    items.push({ value: view.revision, label: shortSha(view.revision) })
  }

  return (
    <Select
      value={pinned ? view.revision : LATEST}
      items={items}
      onValueChange={(value) => {
        if (!value) return
        router.push(value === LATEST ? `/g/${view.id}` : `/g/${view.id}?rev=${value}`)
      }}
    >
      <SelectTrigger size="sm" className="max-w-28 sm:max-w-64" aria-label="Revision">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {children}
    </a>
  )
}

/** Id of the comments panel, which the header's button opens and closes. */
export const COMMENTS_PANEL_ID = "artifact-comments"

export function FrameHeader({
  view,
  viewer,
  urls,
  pinned,
  initiallyStarred,
  commentCount,
  commentsOpen,
  onToggleComments,
}: {
  view: ArtifactView
  viewer: Viewer | null
  urls: FrameUrls
  pinned: boolean
  initiallyStarred: boolean
  /** Null when GitHub did not say how many there are. */
  commentCount: number | null
  commentsOpen: boolean
  onToggleComments: () => void
}) {
  const router = useRouter()
  const [starred, setStarred] = React.useState(initiallyStarred)
  const [pending, startTransition] = React.useTransition()
  const [editing, setEditing] = React.useState<DialogTarget | null>(null)
  const [deleting, setDeleting] = React.useState<DialogTarget | null>(null)

  const isOwner = viewer !== null && viewer.login.toLowerCase() === view.owner.toLowerCase()
  const canWrite = viewer?.canWrite ?? false
  const target: DialogTarget = { id: view.id, title: view.title, description: view.description }
  const outdated = pinned && view.revision !== view.head

  function toggleStar() {
    const next = !starred
    startTransition(async () => {
      const result = await starArtifact(view.id, next)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStarred(next)
      toast.success(next ? "Starred" : "Star removed")
    })
  }

  function fork() {
    startTransition(async () => {
      const result = await forkArtifact(view.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Forked to your account")
      router.push(`/g/${result.data.id}`)
    })
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      <Link
        href={viewer ? "/dashboard" : "/"}
        aria-label={viewer ? "Back to your artifacts" : "Gist Artifacts home"}
        className="rounded-md p-1 text-foreground/80 hover:bg-muted hover:text-foreground"
      >
        <LogoMark />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-sm font-medium">{view.title}</h1>
        <span className="hidden shrink-0 text-sm text-muted-foreground md:inline">by {view.owner}</span>
        {view.isPublic === false ? (
          <Badge variant="outline" className="hidden shrink-0 text-muted-foreground sm:inline-flex">
            <LockIcon />
            Unlisted
          </Badge>
        ) : null}
        {outdated ? (
          <Link
            href={`/g/${view.id}`}
            className={cn(buttonVariants({ variant: "secondary", size: "xs" }), "shrink-0")}
          >
            Older revision · view latest
          </Link>
        ) : null}
      </div>

      <RevisionSelect view={view} pinned={pinned} />
      {/* From tablet width up; on a phone the star is in the details panel, where there is room. */}
      {canWrite ? (
        <Button
          variant="outline"
          size="icon-sm"
          className="hidden sm:inline-flex"
          aria-label={starred ? "Remove your star" : "Star this artifact"}
          aria-pressed={starred}
          title={starred ? "Starred" : "Star"}
          onClick={toggleStar}
          disabled={pending}
        >
          <StarIcon className={starred ? "fill-current" : undefined} />
        </Button>
      ) : urls.signIn ? (
        <a
          href={urls.signIn}
          aria-label="Sign in to star this artifact"
          title="Sign in to star"
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "hidden sm:inline-flex")}
        >
          <StarIcon />
        </a>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        title="Comments"
        aria-label={commentCount ? `Comments (${commentCount})` : "Comments"}
        aria-expanded={commentsOpen}
        aria-controls={COMMENTS_PANEL_ID}
        onClick={onToggleComments}
      >
        <MessageSquareIcon />
        {commentCount ? <span className="tabular-nums">{commentCount}</span> : null}
      </Button>
      <CopyButton value={urls.share} />
      <a
        href={urls.bare}
        target="_blank"
        rel="noreferrer"
        aria-label="Open the artifact on its own page"
        title="Open on its own page"
        className={buttonVariants({ variant: "outline", size: "icon-sm" })}
      >
        <ExternalLinkIcon />
      </a>

      <Sheet>
        <SheetTrigger render={<Button variant="outline" size="icon-sm" aria-label="Artifact details" />}>
          <InfoIcon />
        </SheetTrigger>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="pr-8">{view.title}</SheetTitle>
            <SheetDescription>{view.description ?? "No description."}</SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0">
            <TabsList className="mx-4 self-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="overflow-y-auto p-4">
              <div className="flex flex-wrap gap-2">
                <a
                  href={urls.gist}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLinkIcon data-icon="inline-start" />
                  Source on GitHub
                </a>
                {canWrite ? (
                  <>
                    {/* The header has this button from tablet width up. */}
                    <Button variant="outline" size="sm" className="sm:hidden" onClick={toggleStar} disabled={pending}>
                      <StarIcon data-icon="inline-start" className={starred ? "fill-current" : undefined} />
                      {starred ? "Starred" : "Star"}
                    </Button>
                    {!isOwner ? (
                      <Button variant="outline" size="sm" onClick={fork} disabled={pending}>
                        <GitForkIcon data-icon="inline-start" />
                        Fork
                      </Button>
                    ) : null}
                  </>
                ) : null}
                {isOwner && canWrite ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditing(target)}>
                      <PencilIcon data-icon="inline-start" />
                      Edit details
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleting(target)}>
                      <Trash2Icon data-icon="inline-start" />
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>

              {view.problems.length > 0 ? (
                <div className="mt-4 rounded-lg border bg-muted/50 p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <TriangleAlertIcon className="size-4" />
                    Not a conforming artifact
                  </p>
                  <ul className="mt-1 list-disc pl-6 text-muted-foreground">
                    {view.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <dl className="mt-4 flex flex-col gap-2.5">
                <DetailRow label="Owner">
                  <span className="inline-flex items-center gap-2">
                    <Avatar className="size-5">
                      {view.ownerAvatarUrl ? <AvatarImage src={view.ownerAvatarUrl} alt="" /> : null}
                      <AvatarFallback>{view.owner.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <ExternalLink href={`https://gist.github.com/${view.owner}`}>{view.owner}</ExternalLink>
                  </span>
                </DetailRow>
                {view.isPublic !== null ? (
                  <DetailRow label="Visibility">
                    <span className="inline-flex items-center gap-1.5">
                      {view.isPublic ? <GlobeIcon className="size-3.5" /> : <LockIcon className="size-3.5" />}
                      {view.isPublic ? "Public" : "Unlisted: anyone with the link can view"}
                    </span>
                  </DetailRow>
                ) : null}
                {view.updatedAt ? (
                  <DetailRow label="Updated">
                    <RelativeTime iso={view.updatedAt} />
                  </DetailRow>
                ) : null}
                <DetailRow label="Revision">
                  <code className="font-mono text-xs">{shortSha(view.revision)}</code>
                  {view.revision === view.head ? " (latest)" : ""}
                </DetailRow>
                {view.manifest ? (
                  <>
                    <DetailRow label="Entrypoint">
                      <code className="font-mono text-xs">{view.manifest.entrypoint}</code>
                    </DetailRow>
                    <DetailRow label="Media type">{view.manifest.mediaType}</DetailRow>
                    {view.manifest.generator ? (
                      <DetailRow label="Generator">{view.manifest.generator}</DetailRow>
                    ) : null}
                    {view.manifest.source && /^https?:\/\//.test(view.manifest.source) ? (
                      <DetailRow label="Produced from">
                        <ExternalLink href={view.manifest.source}>{view.manifest.source}</ExternalLink>
                      </DetailRow>
                    ) : null}
                  </>
                ) : null}
                {view.forkOf ? (
                  <DetailRow label="Forked from">
                    <Link href={`/g/${view.forkOf.id}`} className="underline underline-offset-4">
                      {view.forkOf.owner ?? "another Gist"}
                    </Link>
                  </DetailRow>
                ) : null}
              </dl>

              {!view.complete ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  GitHub’s API is not reachable right now, so files, history and visibility are not shown.
                  The artifact itself is unaffected.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="files" className="overflow-y-auto p-4">
              {view.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">The file list is not available right now.</p>
              ) : (
                <>
                  {view.revision !== view.head ? (
                    <p className="mb-3 text-sm text-muted-foreground">
                      Files of the latest revision; links open them at the revision being shown.
                    </p>
                  ) : null}
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {view.files.map((file) => (
                      <li key={file.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <a
                          href={`${urls.files}${encodeURIComponent(file.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 truncate font-mono text-xs underline-offset-4 hover:underline"
                        >
                          {file.name}
                        </a>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatBytes(file.size)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="overflow-y-auto p-4">
              {view.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">The revision history is not available right now.</p>
              ) : (
                <ol className="flex flex-col divide-y rounded-lg border">
                  {view.history.map((entry, index) => {
                    const current = entry.version === view.revision
                    return (
                      <li key={entry.version}>
                        <Link
                          href={index === 0 ? `/g/${view.id}` : `/g/${view.id}?rev=${entry.version}`}
                          aria-current={current ? "true" : undefined}
                          className={cn(
                            "flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted",
                            current && "bg-muted font-medium"
                          )}
                        >
                          <span>{formatDateTime(entry.committedAt)}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {shortSha(entry.version)}
                            {index === 0 ? " · latest" : ""}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <EditDetailsDialog artifact={editing} onClose={() => setEditing(null)} onDone={() => router.refresh()} />
      <DeleteArtifactDialog
        artifact={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => router.push("/dashboard")}
      />
    </header>
  )
}
