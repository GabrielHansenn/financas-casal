// Pure helpers for the dreams board (unit tested): URL filters, owner labels, image paths,
// resize math and masonry column distribution.
import type { DreamCategory, DreamHorizon } from "./labels";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES: DreamCategory[] = [
  "travel", "home", "vehicle", "experience", "career", "pet", "wedding", "education", "other",
];
const HORIZONS: DreamHorizon[] = ["short", "medium", "long", "someday"];

export type DreamTab = "active" | "achieved";

export type DreamFilters = {
  tab: DreamTab;
  category: DreamCategory | null;
  horizon: DreamHorizon | null;
  /** "ours" (no owner) or a member's user id */
  owner: string | null;
};

type RawSearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parses `?tab=&category=&horizon=&owner=`; unknown values fall back to "no filter". */
export function parseDreamFilters(params: RawSearchParams): DreamFilters {
  const tab = first(params.tab);
  const category = first(params.category);
  const horizon = first(params.horizon);
  const owner = first(params.owner);
  return {
    tab: tab === "achieved" ? "achieved" : "active",
    category: CATEGORIES.includes(category as DreamCategory) ? (category as DreamCategory) : null,
    horizon: HORIZONS.includes(horizon as DreamHorizon) ? (horizon as DreamHorizon) : null,
    owner: owner === "ours" ? "ours" : owner && GUID.test(owner) ? owner.toLowerCase() : null,
  };
}

export function dreamsHref(filters: DreamFilters): string {
  const params = new URLSearchParams();
  if (filters.tab !== "active") params.set("tab", filters.tab);
  if (filters.category) params.set("category", filters.category);
  if (filters.horizon) params.set("horizon", filters.horizon);
  if (filters.owner) params.set("owner", filters.owner);
  const query = params.toString();
  return query ? `/sonhos?${query}` : "/sonhos";
}

export function hasActiveFilters(filters: DreamFilters): boolean {
  return filters.category !== null || filters.horizon !== null || filters.owner !== null;
}

type Filterable = {
  status: "dreaming" | "planning" | "achieved";
  category: DreamCategory;
  horizon: DreamHorizon;
  ownerUserId: string | null;
};

export function matchesFilters(dream: Filterable, filters: DreamFilters): boolean {
  const inTab = filters.tab === "achieved" ? dream.status === "achieved" : dream.status !== "achieved";
  if (!inTab) return false;
  if (filters.category && dream.category !== filters.category) return false;
  if (filters.horizon && dream.horizon !== filters.horizon) return false;
  if (filters.owner === "ours" && dream.ownerUserId !== null) return false;
  if (filters.owner && filters.owner !== "ours" && dream.ownerUserId !== filters.owner) return false;
  return true;
}

/** Whose dream it is, from the viewer's point of view: "Nosso", "Meu" or "De Bruno". */
export function ownerLabel(ownerUserId: string | null, viewerId: string, names: Record<string, string>): string {
  if (ownerUserId === null) return "Nosso";
  if (ownerUserId === viewerId) return "Meu";
  return `De ${names[ownerUserId] ?? "ex-membro"}`;
}

export type ImageKind = "cover" | "achieved";

/** Storage path inside the dream's folder; the bucket policies require exactly this shape. */
export function dreamImagePath(
  workspaceId: string,
  dreamId: string,
  kind: ImageKind,
  extension: "webp" | "jpg" | "png",
  unique: string,
): string {
  if (!GUID.test(workspaceId) || !GUID.test(dreamId)) throw new RangeError("Invalid workspace or dream id");
  if (!/^[a-z0-9-]{4,64}$/i.test(unique)) throw new RangeError("Invalid unique suffix");
  return `${workspaceId}/${dreamId}/${kind}-${unique}.${extension}`;
}

/** True when `path` belongs to the given dream's folder (and has no traversal tricks). */
export function isDreamImagePath(path: string, workspaceId: string, dreamId: string): boolean {
  const prefix = `${workspaceId}/${dreamId}/`;
  if (!path.startsWith(prefix)) return false;
  const file = path.slice(prefix.length);
  return /^(cover|achieved)-[a-z0-9-]{4,64}\.(webp|jpg|png)$/i.test(file);
}

/** Target size that fits inside maxWidth x maxHeight keeping the aspect ratio (never upscales). */
export function fitWithin(width: number, height: number, maxWidth = 1600, maxHeight = 1600) {
  if (width <= 0 || height <= 0) throw new RangeError("Invalid image size");
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Round-robin distribution: item i goes to column i % n, so reading row by row keeps the order. */
export function toColumns<T>(items: T[], columnCount: number): T[][] {
  const n = Math.max(1, Math.floor(columnCount));
  const columns: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => columns[i % n]!.push(item));
  return columns;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
