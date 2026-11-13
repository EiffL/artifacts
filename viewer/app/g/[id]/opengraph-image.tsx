import { headers } from "next/headers"
import { connection } from "next/server"

import { artifactCard, CARD_ALT, CARD_SIZE } from "@/lib/artifact-card"
import { appOrigin } from "@/lib/urls"

export const alt = CARD_ALT
export const size = CARD_SIZE
export const contentType = "image/png"

/** The card a shared artifact link unfurls to. Read from GitHub for each request, like the page. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const [{ id }, headerList] = await Promise.all([params, headers()])
  return artifactCard(id, appOrigin(headerList).replace(/^https?:\/\//, ""))
}
