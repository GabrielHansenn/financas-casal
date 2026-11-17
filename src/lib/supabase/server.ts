import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// Server client for Server Components, Server Actions and Route Handlers.
// Reads the session from cookies; it must run inside a <Suspense> boundary when rendering
// (cookies() is a runtime API under Cache Components).
export async function createClient() {
  // Supabase data is per user and must never be prerendered. With partialPrefetching the
  // App Shell render can read cookies, and supabase-js then calls Date.now() (token expiry
  // check), which Next rejects as an unstable value. connection() stops prerendering here so
  // everything below runs only at request time.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. Safe to ignore:
          // the proxy refreshes the session and writes the cookies on every request.
        }
      },
    },
  });
}
