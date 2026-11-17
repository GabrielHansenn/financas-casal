import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Data Access Layer entry point: returns the authenticated user or redirects to login.
 * Deduplicated per request with React cache(). Reads cookies, so callers must render
 * inside a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/entrar");
  }

  return { id: data.claims.sub, email: data.claims.email ?? "" };
});
