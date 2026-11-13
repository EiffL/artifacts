import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-xs tracking-widest text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Nothing here</h1>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        This page does not exist. If you followed a link to an artifact, check that the address is complete.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Gist Artifacts home
      </Link>
    </main>
  )
}
