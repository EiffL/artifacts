import { cacheLife } from "next/cache"
import { StarIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { getRepoStars } from "@/lib/github"
import { REPO_SLUG, REPO_URL, SITE_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

/** The count changes slowly, so one read an hour serves every visitor. */
async function starCount(slug: string): Promise<number | null> {
  "use cache"
  cacheLife("hours")
  return getRepoStars(slug)
}

/**
 * Link to the project's repository, where it can be starred. GitHub only lets a signed-in
 * person star from its own pages, so this opens the repository. The count appears once there
 * is one to show.
 */
export async function StarButton({ className, size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  const stars = await starCount(REPO_SLUG)
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={`Star ${SITE_NAME} on GitHub`}
      className={cn(buttonVariants({ variant: "outline", size }), className)}
    >
      <StarIcon aria-hidden="true" />
      Star on GitHub
      {stars ? (
        <span className="-mr-1 border-l pl-2 text-muted-foreground tabular-nums">{compact.format(stars)}</span>
      ) : null}
    </a>
  )
}
