import { ImageResponse } from "next/og";
import { AppIconImage } from "@/components/app-icon-image";

// PWA icons referenced by app/manifest.ts. Prerendered at build time for each variant.
const VARIANTS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

type Variant = keyof typeof VARIANTS;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, ctx: RouteContext<"/icons/[variant]">) {
  const { variant } = await ctx.params;
  const config = VARIANTS[variant as Variant];
  if (!config) return new Response("Not found", { status: 404 });

  return new ImageResponse(<AppIconImage size={config.size} maskable={config.maskable} />, {
    width: config.size,
    height: config.size,
  });
}
