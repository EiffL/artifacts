"use client"

import { CopyIcon } from "lucide-react"

import { copyText } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** One or more shell lines, with a button that copies them. */
export function Command({ lines, label, className }: { lines: string[]; label: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border bg-muted/60 py-2 pr-2 pl-3.5", className)}>
      <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-[0.8rem] leading-relaxed">{lines.join("\n")}</pre>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy the command for ${label}`}
        onClick={() => copyText(lines.join("\n"), "Command copied")}
      >
        <CopyIcon />
      </Button>
    </div>
  )
}
