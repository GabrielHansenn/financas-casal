import { ImageResponse } from "next/og";
import { AppIconImage } from "@/components/app-icon-image";

// iOS home screen icon (iOS applies its own rounded mask, so use the full-bleed variant)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconImage size={180} maskable />, size);
}
