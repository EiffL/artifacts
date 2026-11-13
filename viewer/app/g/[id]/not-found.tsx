import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function ArtifactNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-xs tracking-widest text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Artifact not found</h1>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        No Gist with this ID exists. It may have been deleted by its owner, or the link may be incomplete.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Gist Artifacts home
      </Link>
    </main>
  )
}
