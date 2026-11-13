import { NextResponse, type NextRequest } from "next/server";

import { isGistId } from "@/lib/config";
import { revalidateGist } from "@/lib/revalidate";

/**
 * POST /api/revalidate?gist=<gist-id>
 *
 * Called by publishing tools right after an update so the new revision is
 * visible immediately. Gists have no webhooks, so GitHub cannot tell us.
 *
 * It needs no authentication: it only re-reads the current revision from
 * GitHub and refreshes what this viewer has cached for it.
 */
export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("gist")?.toLowerCase();
  if (!isGistId(id)) {
    return NextResponse.json({ error: "Pass ?gist=<gist-id>." }, { status: 400 });
  }

  const { revision, changed } = await revalidateGist(id);
  if (!revision) {
    return NextResponse.json({ error: "Gist not found." }, { status: 404 });
  }
  return NextResponse.json(
    { gist: id, revision, changed },
    { headers: { "cache-control": "no-store" } },
  );
}
