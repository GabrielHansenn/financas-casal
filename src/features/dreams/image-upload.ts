// Browser-side image pipeline: validate, resize (max 1600px), compress (WEBP, JPEG fallback)
// and upload straight to the private bucket. Storage RLS checks the {workspace}/{dream}/ path.
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, dreamImagePath, fitWithin, type ImageKind } from "./board";

const BUCKET = "dream-images";

export class ImageError extends Error {}

export function validateImageFile(file: File): void {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageError("Use uma imagem JPG, PNG ou WEBP.");
  }
  if (file.size > MAX_IMAGE_BYTES) throw new ImageError("A imagem pode ter no máximo 5 MB.");
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if ("createImageBitmap" in window) {
    // from-image applies the EXIF orientation (photos taken on phones)
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Resizes to fit 1600x1600 and encodes as WEBP; Safari can't encode WEBP, so it falls back to JPEG. */
export async function compressImage(file: File): Promise<{ blob: Blob; extension: "webp" | "jpg" }> {
  validateImageFile(file);
  const { source, width, height } = await decode(file).catch(() => {
    throw new ImageError("Não foi possível ler essa imagem.");
  });
  const size = fitWithin(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageError("Seu navegador não conseguiu processar a imagem.");
  context.drawImage(source, 0, 0, size.width, size.height);
  if ("close" in source && typeof source.close === "function") source.close();

  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, extension: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new ImageError("Não foi possível comprimir a imagem.");
  return { blob: jpeg, extension: "jpg" };
}

/** Compresses and uploads; returns the storage path to save on the dream. */
export async function uploadDreamImage(
  workspaceId: string,
  dreamId: string,
  kind: ImageKind,
  file: File,
): Promise<string> {
  const { blob, extension } = await compressImage(file);
  if (blob.size > MAX_IMAGE_BYTES) throw new ImageError("A imagem ficou grande demais mesmo comprimida.");
  const path = dreamImagePath(workspaceId, dreamId, kind, extension, crypto.randomUUID());
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "3600", upsert: false });
  if (error) throw new ImageError("Não foi possível enviar a imagem. Tente de novo.");
  return path;
}
