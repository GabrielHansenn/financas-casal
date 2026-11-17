"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { escapeHtml, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { parseBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "./active-workspace";
import { INVITE_TOKEN_PATTERN } from "./invite-token";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type ActionResult = { ok: true } | { ok: false; error: string };

const workspaceId = z.uuid({ error: "Workspace inválido." });
const workspaceName = z
  .string()
  .trim()
  .min(1, { error: "Dê um nome ao workspace." })
  .max(80, { error: "Nome muito longo (máximo de 80 caracteres)." });

async function setActiveWorkspaceCookie(id: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

function logUnexpected(context: string, error: PostgrestError) {
  console.error(`[workspaces] ${context}`, error.code, error.message);
}

// ---------------------------------------------------------------------------
// Switch active workspace
// ---------------------------------------------------------------------------
export async function switchWorkspace(id: string): Promise<ActionResult> {
  const parsed = workspaceId.safeParse(id);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const user = await getCurrentUser();
  const supabase = await createClient();

  // RLS only returns memberships of workspaces the current user belongs to
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Você não tem acesso a esse workspace." };

  await setActiveWorkspaceCookie(parsed.data);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Create shared workspace
// ---------------------------------------------------------------------------
export type CreateWorkspaceState = { error?: string } | null;

export async function createSharedWorkspace(
  _prev: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const parsed = workspaceName.safeParse(formData.get("name"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shared_workspace", { p_name: parsed.data });

  if (error || !data) {
    if (error) logUnexpected("create_shared_workspace", error);
    return { error: "Não foi possível criar o workspace. Tente novamente." };
  }

  // The new workspace becomes the active one
  await setActiveWorkspaceCookie(data);
  redirect("/workspaces");
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
export type InviteState =
  | { ok: true; link: string; email: string; emailSent: boolean }
  | { ok: false; error: string }
  | null;

const inviteSchema = z.object({
  workspaceId,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Informe um email válido." })),
});

export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const user = await getCurrentUser();
  if (parsed.data.email === user.email.toLowerCase()) {
    return { ok: false, error: "Você já faz parte deste workspace." };
  }

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_workspace_invite", {
    p_workspace_id: parsed.data.workspaceId,
    p_email: parsed.data.email,
  });

  if (error || !token) {
    switch (error?.code) {
      case "23505":
        return { ok: false, error: "Essa pessoa já faz parte do workspace." };
      case "22023":
        return { ok: false, error: "Informe um email válido." };
      case "23514":
        return { ok: false, error: "Não é possível convidar para o workspace pessoal." };
      case "42501":
        return { ok: false, error: "Só o dono do workspace pode convidar pessoas." };
      default:
        if (error) logUnexpected("create_workspace_invite", error);
        return { ok: false, error: "Não foi possível criar o convite. Tente novamente." };
    }
  }

  const link = `${env.siteUrl}/convite/${token}`;

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from("workspaces").select("name").eq("id", parsed.data.workspaceId).single(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  const inviterName = profile?.display_name ?? "Alguém";
  const workspaceLabel = workspace?.name ?? "um workspace";

  const emailSent = await sendEmail({
    to: parsed.data.email,
    subject: `${inviterName} convidou você para "${workspaceLabel}"`,
    text:
      `${inviterName} convidou você para organizar as finanças juntos no workspace "${workspaceLabel}" do Finanças Casal.\n\n` +
      `Aceite o convite: ${link}\n\nO convite vale por 7 dias.`,
    html: `
      <h2>Você foi convidado(a)!</h2>
      <p><strong>${escapeHtml(inviterName)}</strong> convidou você para organizar as finanças juntos no workspace
      <strong>${escapeHtml(workspaceLabel)}</strong> do Finanças Casal.</p>
      <p><a href="${escapeHtml(link)}"
        style="display:inline-block;padding:12px 20px;background:#171717;color:#ffffff;border-radius:8px;text-decoration:none">
        Aceitar convite</a></p>
      <p style="color:#737373;font-size:12px">O convite vale por 7 dias. Se você não esperava este email, ignore-o.</p>`,
  });

  refresh();
  return { ok: true, link, email: parsed.data.email, emailSent };
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(inviteId);
  if (!parsed.success) return { ok: false, error: "Convite inválido." };

  await getCurrentUser();
  const supabase = await createClient();
  // RLS: only owners can update, and only pending invites, and only to 'revoked'
  const { data, error } = await supabase
    .from("workspace_invites")
    .update({ status: "revoked" })
    .eq("id", parsed.data)
    .eq("status", "pending")
    .select("id");

  if (error) {
    logUnexpected("revokeInvite", error);
    return { ok: false, error: "Não foi possível cancelar o convite." };
  }
  if (data.length === 0) return { ok: false, error: "Convite não encontrado ou já usado." };

  refresh();
  return { ok: true };
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  if (!INVITE_TOKEN_PATTERN.test(token)) return { ok: false, error: "Convite inválido." };

  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_workspace_invite", { p_token: token });

  if (error || !data) {
    if (error?.message.includes("email not confirmed")) {
      return { ok: false, error: "Confirme seu email antes de aceitar o convite." };
    }
    switch (error?.code) {
      case "P0002":
        return { ok: false, error: "Este convite expirou, foi cancelado ou já foi usado." };
      case "42501":
        return { ok: false, error: "Este convite foi enviado para outro email." };
      default:
        if (error) logUnexpected("accept_workspace_invite", error);
        return { ok: false, error: "Não foi possível aceitar o convite. Tente novamente." };
    }
  }

  await setActiveWorkspaceCookie(data);
  redirect("/");
}

// ---------------------------------------------------------------------------
// Workspace settings
// ---------------------------------------------------------------------------
export type FormState = { ok?: boolean; error?: string } | null;

export async function renameWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ workspaceId, name: workspaceName })
    .safeParse({ workspaceId: formData.get("workspaceId"), name: formData.get("name") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.workspaceId)
    .select("id");

  if (error) {
    logUnexpected("renameWorkspace", error);
    return { error: "Não foi possível renomear." };
  }
  if (data.length === 0) return { error: "Só o dono pode renomear o workspace." };

  refresh();
  return { ok: true };
}

export async function updateMemberIncome(_prev: FormState, formData: FormData): Promise<FormState> {
  const ids = z
    .object({ workspaceId, userId: z.uuid() })
    .safeParse({ workspaceId: formData.get("workspaceId"), userId: formData.get("userId") });
  if (!ids.success) return { error: "Dados inválidos." };

  const raw = String(formData.get("income") ?? "").trim();
  let incomeCents: number | null = null;
  if (raw !== "") {
    incomeCents = parseBRL(raw);
    if (incomeCents === null || incomeCents < 0) return { error: "Informe um valor válido, ex.: 4.500,00" };
  }

  await getCurrentUser();
  const supabase = await createClient();
  // RLS: a member can edit their own income; owners can edit anyone's in their workspace
  const { data, error } = await supabase
    .from("workspace_members")
    .update({ income_cents: incomeCents })
    .eq("workspace_id", ids.data.workspaceId)
    .eq("user_id", ids.data.userId)
    .select("user_id");

  if (error) {
    logUnexpected("updateMemberIncome", error);
    return { error: "Não foi possível salvar a renda." };
  }
  if (data.length === 0) return { error: "Você não pode alterar a renda desta pessoa." };

  refresh();
  return { ok: true };
}

export async function leaveWorkspace(id: string): Promise<ActionResult> {
  const parsed = workspaceId.safeParse(id);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const user = await getCurrentUser();
  const supabase = await createClient();
  // RLS: non-owners can delete their own membership of a shared workspace
  const { data, error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", parsed.data)
    .eq("user_id", user.id)
    .select("user_id");

  if (error) {
    logUnexpected("leaveWorkspace", error);
    return { ok: false, error: "Não foi possível sair do workspace." };
  }
  if (data.length === 0) {
    return { ok: false, error: "O dono não pode sair. Exclua o workspace se não for mais usá-lo." };
  }

  // The active-workspace cookie falls back to the personal workspace automatically
  refresh();
  return { ok: true };
}

export async function removeMember(id: string, userId: string): Promise<ActionResult> {
  const parsed = z.object({ workspaceId, userId: z.uuid() }).safeParse({ workspaceId: id, userId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  await getCurrentUser();
  const supabase = await createClient();
  // RLS: owners can remove non-owner members of shared workspaces
  const { data, error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.userId)
    .select("user_id");

  if (error) {
    logUnexpected("removeMember", error);
    return { ok: false, error: "Não foi possível remover a pessoa." };
  }
  if (data.length === 0) return { ok: false, error: "Você não pode remover esta pessoa." };

  refresh();
  return { ok: true };
}

export async function deleteWorkspace(id: string): Promise<ActionResult> {
  const parsed = workspaceId.safeParse(id);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  await getCurrentUser();
  const supabase = await createClient();
  // RLS: only owners, only shared workspaces. Cascades to all data of the workspace.
  const { data, error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", parsed.data)
    .select("id");

  if (error) {
    logUnexpected("deleteWorkspace", error);
    return { ok: false, error: "Não foi possível excluir o workspace." };
  }
  if (data.length === 0) return { ok: false, error: "Só o dono pode excluir este workspace." };

  refresh();
  return { ok: true };
}
