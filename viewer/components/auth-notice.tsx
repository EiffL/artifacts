"use client"

import { useSearchParams } from "next/navigation"

const MESSAGES: Record<string, string> = {
  failed: "Sign-in with GitHub did not complete. Please try again.",
  unconfigured:
    "Sign-in is not set up on this deployment yet. Viewing artifacts works without an account.",
}

/** Explains a failed sign-in redirect (`/?auth=…`). Needs a Suspense boundary. */
export function AuthNotice() {
  const reason = useSearchParams().get("auth")
  const message = reason ? MESSAGES[reason] : undefined
  if (!message) return null
  return (
    <p role="alert" className="mx-auto mb-6 max-w-xl rounded-lg border bg-muted/50 px-4 py-2.5 text-sm">
      {message}
    </p>
  )
}
