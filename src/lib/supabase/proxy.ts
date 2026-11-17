import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// Routes reachable without a session
const PUBLIC_PATHS = ["/entrar", "/cadastro", "/auth", "/convite", "/offline"];
// Routes that make no sense for a logged-in user
const GUEST_ONLY_PATHS = ["/entrar", "/cadastro"];

function matches(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Refreshes the Supabase session on every request and enforces route protection.
 * The authoritative checks still happen on the server (DAL) and in the database (RLS);
 * this only avoids rendering protected pages for anonymous visitors.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Prevents CDNs from caching responses that carry refreshed auth cookies
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Must run before any response is produced: it refreshes expired tokens.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/entrar" && pathname !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed session cookies on the redirect
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!isLoggedIn && !matches(pathname, PUBLIC_PATHS)) {
    return redirectTo("/entrar");
  }
  if (isLoggedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    return redirectTo("/");
  }

  return response;
}
