import { Suspense } from "react"
import type { Metadata } from "next"

import { ArtifactList, ArtifactListSkeleton } from "@/components/artifact-list"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = { title: "Starred" }

export default function Page() {
  return (
    <>
      <SiteHeader title="Starred" />
      <Suspense fallback={<ArtifactListSkeleton />}>
        <ArtifactList kind="starred" />
      </Suspense>
    </>
  )
}
