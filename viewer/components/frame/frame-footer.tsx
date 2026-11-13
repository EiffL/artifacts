import Link from "next/link"

import { LogoMark } from "@/components/logo"
import { OnboardAgentButton } from "@/components/onboard-agent-button"
import { SITE_NAME } from "@/lib/site"

/**
 * A quiet strip under every artifact: what published it, and how a reader gets the same for
 * their own agent. Every shared artifact is where most people first meet the project.
 */
export function FrameFooter({ prompt }: { prompt: string }) {
  return (
    <footer className="flex h-10 shrink-0 items-center justify-between gap-3 border-t bg-background px-3 text-xs text-muted-foreground">
      <Link href="/" className="flex min-w-0 items-center gap-1.5 hover:text-foreground">
        <LogoMark className="size-4 text-foreground" />
        <span className="truncate">
          <span className="hidden sm:inline">Published with </span>
          <span className="font-medium text-foreground">{SITE_NAME}</span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        <Link href="/#install" className="hidden hover:text-foreground sm:inline">
          Create your own
        </Link>
        <OnboardAgentButton prompt={prompt} size="xs" />
      </div>
    </footer>
  )
}
