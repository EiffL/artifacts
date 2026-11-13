"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { copyText } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Copies a prompt that a person pastes into their agent to have it install the skill. The
 * tooltip shows the prompt, so nobody pastes something they have not seen.
 */
export function OnboardAgentButton({
  prompt,
  ...props
}: { prompt: string } & Omit<React.ComponentProps<typeof Button>, "onClick" | "children">) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            {...props}
            onClick={async () => {
              await copyText(prompt, "Prompt copied. Paste it into your agent.")
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
          />
        }
      >
        Onboard your agent
        {copied ? <CheckIcon data-icon="inline-end" /> : <CopyIcon data-icon="inline-end" />}
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="block max-w-sm py-2 leading-relaxed">
        Copies this prompt: <span className="font-mono">{prompt}</span>
      </TooltipContent>
    </Tooltip>
  )
}
