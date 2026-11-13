"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseGistReference } from "@/lib/config"
import { cn } from "@/lib/utils"

/** Opens an artifact from a pasted Gist URL or ID. */
export function OpenArtifactForm({ className, compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter()
  const [value, setValue] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const errorId = React.useId()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const id = parseGistReference(value)
    if (!id) {
      setError("That does not look like a Gist URL or ID.")
      return
    }
    setError(null)
    router.push(`/g/${id}`)
  }

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-1.5", className)} noValidate>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          placeholder="Paste a Gist URL or ID"
          aria-label="Gist URL or ID"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
          className={cn("min-w-0 flex-1", compact ? "h-8" : "h-10")}
        />
        <Button type="submit" size={compact ? "default" : "lg"} className={compact ? undefined : "h-10 px-4"}>
          Open
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
