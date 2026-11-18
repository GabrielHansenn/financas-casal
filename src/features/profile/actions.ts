"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "@/lib/zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removeWorkspaceDreamImages } from "@/features/dreams/storage";
import { ACTIVE_WORKSPACE_COOKIE } from "@/features/workspaces/active-workspace";
import { DELETE_ACCOUNT_CONFIRMATION } from "./constants";

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: "Informe seu nome." })
    .max(80, { error: "Nome muito longo." }),
});

export type ProfileFormState = { ok?: boolean; error?: string } | null;

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id)
    .select("id");

  if (error) return { error: "Não foi possível salvar. Tente novamente." };
  if (data.length === 0) return { error: "Perfil não encontrado. Entre de novo e tente outra vez." };

  refresh();
  return { ok: true };
}

export type AccountDeletionPreview = {
  /** Shared workspaces that will be deleted because the user is their only member */
  deletedShared: string[];
  /** Shared workspaces that stay, with who becomes the owner when the user owns them */
  kept: { name: string; newOwner: string | null }[];
};

/** What deleting the account does to each workspace, shown before the user confirms. */
export async function getAccountDeletionPreview(): Promise<
  { ok: true; preview: AccountDeletionPreview } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "role, workspace:workspaces(id, name, type, members:workspace_members(user_id, joined_at, profile:profiles(display_name)))",
    )
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Não foi possível carregar seus workspaces." };

  const preview: AccountDeletionPreview = { deletedShared: [], kept: [] };
  for (const membership of data) {
    const workspace = membership.workspace;
    if (!workspace || workspace.type !== "shared") continue;
    const others = workspace.members
      .filter((m) => m.user_id !== user.id)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    if (others.length === 0) preview.deletedShared.push(workspace.name);
    else {
      preview.kept.push({
        name: workspace.name,
        newOwner: membership.role === "owner" ? (others[0]?.profile?.display_name ?? "outro membro") : null,
      });
    }
  }
  return { ok: true, preview };
}

/**
 * Deletes the user's account (LGPD). The database trigger on auth.users deletes the personal
 * workspace and shared workspaces where the user is alone, hands over the ones they own, and
 * keeps an anonymized profile ("Ex-membro") so shared history stays consistent.
 * Dream images are removed here first: storage files can't be deleted from SQL.
 */
export async function deleteMyAccount(confirmation: string): Promise<{ ok: false; error: string }> {
  if (confirmation.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION) {
    return { ok: false, error: `Digite ${DELETE_ACCOUNT_CONFIRMATION} para confirmar.` };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: memberships, error: loadError } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(id, type, members:workspace_members(user_id))")
    .eq("user_id", user.id);
  if (loadError) return { ok: false, error: "Não foi possível excluir a conta. Tente novamente." };

  const toDelete = memberships
    .map((m) => m.workspace)
    .filter((w) => !!w && (w.type === "personal" || w.members.every((m) => m.user_id === user.id)));
  for (const workspace of toDelete) {
    if (workspace) await removeWorkspaceDreamImages(supabase, workspace.id);
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[profile] delete account", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir a conta. Tente novamente." };
  }

  // The user no longer exists: drop the session cookies locally
  await supabase.auth.signOut({ scope: "local" });
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/entrar?aviso=conta-excluida");
}
