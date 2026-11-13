"use client"

import * as React from "react"

import { commentOnArtifact, loadComments, type CommentView } from "@/app/actions"
import { RelativeTime } from "@/components/relative-time"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; comments: CommentView[] }

/**
 * The Gist's own comment thread. Loaded when first shown; bodies are rendered
 * as plain text because they come from arbitrary GitHub accounts.
 */
export function Comments({
  gistId,
  gistUrl,
  canComment,
  signInUrl,
  onCount,
}: {
  gistId: string
  gistUrl: string
  canComment: boolean
  signInUrl: string | null
  /** Called with the number of comments once they are loaded, and again after posting one. */
  onCount?: (count: number) => void
}) {
  const [state, setState] = React.useState<State>({ status: "loading" })
  const [draft, setDraft] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    let cancelled = false
    loadComments(gistId).then((result) => {
      if (cancelled) return
      setState(
        result.ok ? { status: "ready", comments: result.data } : { status: "error", message: result.error }
      )
      if (result.ok) onCount?.(result.data.length)
    })
    return () => {
      cancelled = true
    }
    // The thread is loaded once per Gist; the callback is only told about it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gistId])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await commentOnArtifact(gistId, draft)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError(null)
      setDraft("")
      const comments = state.status === "ready" ? [...state.comments, result.data] : [result.data]
      setState({ status: "ready", comments })
      onCount?.(comments.length)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {state.status === "loading" ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading comments">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : state.comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {state.comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar className="size-7">
                {comment.authorAvatarUrl ? <AvatarImage src={comment.authorAvatarUrl} alt="" /> : null}
                <AvatarFallback>{(comment.author ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{comment.author ?? "ghost"}</span>
                  <RelativeTime iso={comment.createdAt} className="text-xs text-muted-foreground" />
                </div>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Leave a comment. Quote the passage you mean with > …"
            aria-label="Comment"
            rows={3}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="sm" className="self-end" disabled={pending || !draft.trim()}>
            {pending ? "Posting…" : "Comment"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {signInUrl ? (
            <a href={signInUrl} className={buttonVariants({ size: "sm" })}>
              Sign in to comment
            </a>
          ) : null}
          <a
            href={`${gistUrl}#comments`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Comment on GitHub
          </a>
        </div>
      )}
    </div>
  )
}
