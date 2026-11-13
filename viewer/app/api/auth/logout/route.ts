import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";
import { requestOrigin } from "@/lib/urls";

export async function POST(request: NextRequest) {
  const origin = requestOrigin(request.headers);
  // Sign-out is a form POST from this site only.
  const source = request.headers.get("origin");
  if (source && source !== origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const response = NextResponse.redirect(`${origin}/`, 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
