import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { authConfigured, getSession } from "@/lib/session"

/**
 * Header entry point to the dashboard. Reads the session, so render it behind
 * a Suspense boundary.
 */
export async function AuthStatus() {
  const session = await getSession()
  if (session) {
    return (
      <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
        Your artifacts
      </Link>
    )
  }
  if (!authConfigured()) return null
  return (
    <a href="/api/auth/login" className={buttonVariants({ size: "sm" })}>
      Sign in with GitHub
    </a>
  )
}
