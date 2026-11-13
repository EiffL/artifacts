"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { Comments } from "@/components/frame/comments"
import { COMMENTS_PANEL_ID, FrameHeader, type FrameUrls } from "@/components/frame/frame-header"
import { Button } from "@/components/ui/button"
import type { ArtifactView } from "@/lib/artifacts"
import type { Viewer } from "@/lib/session"

/**
 * The framed view: the header, the artifact, and the comment thread beside it when the
 * header's comments button is on. The artifact is passed in as children and never remounts,
 * so opening the thread does not reload the page being discussed.
 */
export function FrameShell({
  view,
  viewer,
  urls,
  pinned,
  initiallyStarred,
  children,
}: {
  view: ArtifactView
  viewer: Viewer | null
  urls: FrameUrls
  pinned: boolean
  initiallyStarred: boolean
  children: React.ReactNode
}) {
  const [commentsOpen, setCommentsOpen] = React.useState(false)
  // The thread is fetched the first time it is shown, then kept, so a draft survives closing it.
  const [commentsLoaded, setCommentsLoaded] = React.useState(false)
  const [commentCount, setCommentCount] = React.useState(view.commentCount)

  function toggleComments() {
    setCommentsLoaded(true)
    setCommentsOpen((open) => !open)
  }

  return (
    <div className="flex h-dvh flex-col">
      <FrameHeader
        view={view}
        viewer={viewer}
        urls={urls}
        pinned={pinned}
        initiallyStarred={initiallyStarred}
        commentCount={commentCount}
        commentsOpen={commentsOpen}
        onToggleComments={toggleComments}
      />
      <div className="relative flex min-h-0 flex-1">
        {children}
        {/* Beside the artifact where there is room, over it on a phone. */}
        <aside
          id={COMMENTS_PANEL_ID}
          aria-label="Comments"
          hidden={!commentsOpen}
          className="absolute inset-0 z-10 flex flex-col border-l bg-background md:static md:w-96 md:shrink-0"
        >
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b pr-2 pl-4">
            <h2 className="text-sm font-medium">Comments</h2>
            <Button variant="ghost" size="icon-sm" aria-label="Close comments" onClick={() => setCommentsOpen(false)}>
              <XIcon />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-4 text-xs text-pretty text-muted-foreground">
              This is the Gist&apos;s own comment thread, kept on GitHub with the artifact.
            </p>
            {commentsLoaded ? (
              <Comments
                gistId={view.id}
                gistUrl={urls.gist}
                canComment={viewer?.canWrite ?? false}
                signInUrl={urls.signIn}
                onCount={setCommentCount}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
