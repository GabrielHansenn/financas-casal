// Markup for the app icon rendered by next/og ImageResponse (favicon, Apple and PWA icons).
// ImageResponse supports a subset of CSS (flexbox, inline styles only).

const WALLET_PATH =
  "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1 M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4";

export function AppIconImage({ size, maskable = false }: { size: number; maskable?: boolean }) {
  // Maskable icons need the artwork inside the central 80% "safe zone"
  const glyph = Math.round(size * (maskable ? 0.45 : 0.56));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
        borderRadius: maskable ? 0 : Math.round(size * 0.22),
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={WALLET_PATH} />
      </svg>
    </div>
  );
}
