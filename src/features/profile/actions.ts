"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  refresh();
  return { ok: true };
}
