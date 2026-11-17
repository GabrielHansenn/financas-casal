import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, PWA files and images. /icon and /apple-icon are generated
    // without a file extension and must stay public (browsers/iOS fetch them without a session).
    "/((?!_next/static|_next/image|favicon.ico|icon$|apple-icon$|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
