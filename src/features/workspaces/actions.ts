"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "./active-workspace";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function switchWorkspace(workspaceId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(workspaceId);
  if (!parsed.success) return { ok: false, error: "Workspace inválido." };

  const user = await getCurrentUser();
  const supabase = await createClient();

  // RLS only returns memberships of the current user's workspaces
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Você não tem acesso a esse workspace." };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  refresh();
  return { ok: true };
}
