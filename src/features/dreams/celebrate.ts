// Light confetti burst when a dream comes true. Loaded on demand (only this moment needs it)
// and skipped entirely for users who prefer reduced motion.
export async function celebrate(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  const shared = { disableForReducedMotion: true, ticks: 180, scalar: 0.9, zIndex: 100 };
  void confetti({ ...shared, particleCount: 70, spread: 70, origin: { x: 0.5, y: 0.7 } });
  setTimeout(() => {
    void confetti({ ...shared, particleCount: 35, angle: 60, spread: 55, origin: { x: 0, y: 0.75 } });
    void confetti({ ...shared, particleCount: 35, angle: 120, spread: 55, origin: { x: 1, y: 0.75 } });
  }, 180);
}
