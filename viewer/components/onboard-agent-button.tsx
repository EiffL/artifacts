"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { copyText } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { onboardingPrompt } from "@/lib/onboarding"

const noSubscription = () => () => {}

/** The address this page is served from, once in the browser; null while rendering on the server. */
function useOrigin(): string | null {
  return React.useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  )
}

/**
 * Copies a prompt that a person pastes into their agent to have it install the skill. The
 * tooltip shows the prompt, so nobody pastes something they have not seen. The prompt points
 * at this viewer's own setup page, so a self-hosted viewer onboards agents to itself.
 */
export function OnboardAgentButton(props: Omit<React.ComponentProps<typeof Button>, "onClick" | "children">) {
  const origin = useOrigin()
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
              await copyText(onboardingPrompt(window.location.origin), "Prompt copied. Paste it into your agent.")
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
          />
        }
      >
        Onboard your agent
        {copied ? <CheckIcon data-icon="inline-end" /> : <CopyIcon data-icon="inline-end" />}
      </TooltipTrigger>
      {origin ? (
        <TooltipContent side="bottom" align="end" className="block max-w-sm py-2 leading-relaxed">
          Copies this prompt: <span className="font-mono">{onboardingPrompt(origin)}</span>
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}
