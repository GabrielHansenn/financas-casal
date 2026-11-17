// Reactions summary and "dream of the week" selection (pure, unit tested).

export type ReactionType = "love" | "me_too";
export type DreamReaction = { userId: string; type: ReactionType };

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "love", emoji: "❤️", label: "Amei" },
  { type: "me_too", emoji: "🙋", label: "Eu também quero!" },
];

export type ReactionSummary = Record<ReactionType, { count: number; mine: boolean; names: string[] }>;

/** Count, whether the viewer reacted, and who reacted ("Você" first, then others by name). */
export function summarizeReactions(
  reactions: DreamReaction[],
  viewerId: string,
  names: Record<string, string>,
): ReactionSummary {
  const summary = {} as ReactionSummary;
  for (const { type } of REACTIONS) {
    const users = reactions.filter((r) => r.type === type).map((r) => r.userId);
    const mine = users.includes(viewerId);
    const others = users
      .filter((u) => u !== viewerId)
      .map((u) => names[u] ?? "Ex-membro")
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    summary[type] = { count: users.length, mine, names: mine ? ["Você", ...others] : others };
  }
  return summary;
}

/** Applies a toggle locally (optimistic UI): adds the viewer's reaction or removes it. */
export function toggleReaction(reactions: DreamReaction[], viewerId: string, type: ReactionType): DreamReaction[] {
  const exists = reactions.some((r) => r.userId === viewerId && r.type === type);
  return exists
    ? reactions.filter((r) => !(r.userId === viewerId && r.type === type))
    : [...reactions, { userId: viewerId, type }];
}

/** ISO-8601 week of a "YYYY-MM-DD" date, e.g. "2026-W47" (weeks start on Monday). */
export function isoWeekKey(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = date.getUTCDay() || 7; // Monday=1 ... Sunday=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** 32-bit FNV-1a: small, stable string hash (same result on server and client). */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * "Sonho da semana": one dream (not achieved) per workspace per ISO week, chosen
 * deterministically, so it stays the same all week without storing anything. Dreams are
 * ordered by id, so the choice does not depend on the board's manual order.
 */
export function pickDreamOfWeek<T extends { id: string; status: string }>(
  dreams: T[],
  workspaceId: string,
  today: string,
): T | null {
  const candidates = dreams.filter((d) => d.status !== "achieved").sort((a, b) => (a.id < b.id ? -1 : 1));
  if (candidates.length === 0) return null;
  return candidates[fnv1a(`${workspaceId}:${isoWeekKey(today)}`) % candidates.length]!;
}
