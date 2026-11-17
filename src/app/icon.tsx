import { ImageResponse } from "next/og";
import { AppIconImage } from "@/components/app-icon-image";

// Browser favicon
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIconImage size={64} />, size);
}
