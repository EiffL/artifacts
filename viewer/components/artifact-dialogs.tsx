"use client"

import * as React from "react"
import { toast } from "sonner"

import { deleteArtifact, updateArtifactDetails } from "@/app/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type DialogTarget = { id: string; title: string; description: string | null }

type DialogProps = {
  artifact: DialogTarget | null
  onClose: () => void
  /** Called after GitHub accepted the change. */
  onDone: () => void
}

export function EditDetailsDialog({ artifact, onClose, onDone }: DialogProps) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!artifact) return
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await updateArtifactDetails(artifact.id, {
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success("Details saved as a new revision")
      onDone()
      onClose()
    })
  }

  return (
    <Dialog
      open={artifact !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4" key={artifact?.id}>
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>
              Saving rewrites artifact.json and the Gist description in one new revision.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="artifact-title">Title</Label>
            <Input id="artifact-title" name="title" defaultValue={artifact?.title ?? ""} required maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="artifact-description">Description</Label>
            <Textarea
              id="artifact-description"
              name="description"
              defaultValue={artifact?.description ?? ""}
              rows={3}
              maxLength={500}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteArtifactDialog({ artifact, onClose, onDone }: DialogProps) {
  const [pending, startTransition] = React.useTransition()

  function confirm() {
    if (!artifact) return
    startTransition(async () => {
      const result = await deleteArtifact(artifact.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Artifact deleted")
      onDone()
      onClose()
    })
  }

  return (
    <AlertDialog
      open={artifact !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this artifact?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the Gist “{artifact?.title}” from GitHub, with all its revisions and comments.
            Every link to it stops working. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete artifact"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
