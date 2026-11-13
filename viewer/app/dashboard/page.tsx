import { Suspense } from "react"
import type { Metadata } from "next"

import { ArtifactList, ArtifactListSkeleton } from "@/components/artifact-list"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = { title: "My artifacts" }

export default function Page() {
  return (
    <>
      <SiteHeader title="My artifacts" />
      <Suspense fallback={<ArtifactListSkeleton />}>
        <ArtifactList kind="mine" />
      </Suspense>
    </>
  )
}
