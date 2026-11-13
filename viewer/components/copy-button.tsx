"use client"

import * as React from "react"
import { CheckIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export async function copyText(text: string, message = "Link copied"): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  } catch {
    toast.error("Could not copy. Copy it from the address bar instead.")
  }
}

/** Copies `value` to the clipboard and confirms briefly. */
export function CopyButton({
  value,
  label = "Copy link",
  showLabel = true,
  ...props
}: {
  value: string
  label?: string
  showLabel?: boolean
} & Omit<React.ComponentProps<typeof Button>, "value" | "onClick">) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={label}
      {...props}
      onClick={async () => {
        await copyText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <CheckIcon data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
      {showLabel ? <span className="hidden sm:inline">{label}</span> : null}
    </Button>
  )
}
