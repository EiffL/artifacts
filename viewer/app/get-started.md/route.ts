import { GET_STARTED_PATH, getStartedMarkdown } from "@/lib/onboarding";
import { appOrigin } from "@/lib/urls";

/**
 * Setup instructions for an agent, as Markdown. The "Onboard your agent" button copies a
 * prompt that points here. The address inside the text is the one the request came to, so a
 * self-hosted viewer onboards agents to itself.
 */
export function GET(request: Request): Response {
  return new Response(getStartedMarkdown(appOrigin(request.headers)), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `inline; filename="${GET_STARTED_PATH.slice(1)}"`,
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}
