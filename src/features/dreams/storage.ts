import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const DREAM_IMAGES_BUCKET = "dream-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Signed URLs for many paths in one request (private bucket). Missing/denied paths are omitted. */
export async function signDreamImages(supabase: Supabase, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from(DREAM_IMAGES_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("[dreams] sign urls", error?.message);
    return new Map();
  }
  return new Map(
    data.flatMap((d) => (d.signedUrl && d.path && !d.error ? [[d.path, d.signedUrl] as [string, string]] : [])),
  );
}

/** Removes every file of one dream ({workspace}/{dream}/*). Best effort: logs and continues. */
export async function removeDreamFolder(supabase: Supabase, workspaceId: string, dreamId: string): Promise<void> {
  const bucket = supabase.storage.from(DREAM_IMAGES_BUCKET);
  const folder = `${workspaceId}/${dreamId}`;
  const { data, error } = await bucket.list(folder, { limit: 1000 });
  if (error) {
    console.error("[dreams] list folder", folder, error.message);
    return;
  }
  const files = data.filter((f) => f.id !== null).map((f) => `${folder}/${f.name}`);
  if (files.length === 0) return;
  const { error: removeError } = await bucket.remove(files);
  if (removeError) console.error("[dreams] remove folder", folder, removeError.message);
}

/** Removes all dream images of a workspace (used before deleting the workspace). */
export async function removeWorkspaceDreamImages(supabase: Supabase, workspaceId: string): Promise<void> {
  const { data, error } = await supabase.storage.from(DREAM_IMAGES_BUCKET).list(workspaceId, { limit: 1000 });
  if (error) {
    console.error("[dreams] list workspace images", error.message);
    return;
  }
  // Entries without id are folders: one per dream
  for (const folder of data.filter((entry) => entry.id === null)) {
    await removeDreamFolder(supabase, workspaceId, folder.name);
  }
}

export async function removeDreamFile(supabase: Supabase, path: string): Promise<void> {
  const { error } = await supabase.storage.from(DREAM_IMAGES_BUCKET).remove([path]);
  if (error) console.error("[dreams] remove file", error.message);
}
