import {
  BriefcaseIcon,
  CarIcon,
  GemIcon,
  GraduationCapIcon,
  HouseIcon,
  PawPrintIcon,
  PlaneIcon,
  SparklesIcon,
  TicketIcon,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/types/database";

export type DreamCategory = Database["public"]["Enums"]["dream_category"];
export type DreamHorizon = Database["public"]["Enums"]["dream_horizon"];
export type DreamStatus = Database["public"]["Enums"]["dream_status"];

export const DREAM_CATEGORIES: { value: DreamCategory; label: string; icon: LucideIcon; color: string }[] = [
  { value: "travel", label: "Viagem", icon: PlaneIcon, color: "#0ea5e9" },
  { value: "home", label: "Casa", icon: HouseIcon, color: "#f97316" },
  { value: "vehicle", label: "Veículo", icon: CarIcon, color: "#64748b" },
  { value: "experience", label: "Experiência", icon: TicketIcon, color: "#a855f7" },
  { value: "career", label: "Carreira", icon: BriefcaseIcon, color: "#16a34a" },
  { value: "pet", label: "Pet", icon: PawPrintIcon, color: "#84cc16" },
  { value: "wedding", label: "Casamento", icon: GemIcon, color: "#ec4899" },
  { value: "education", label: "Estudos", icon: GraduationCapIcon, color: "#6366f1" },
  { value: "other", label: "Outro", icon: SparklesIcon, color: "#eab308" },
];

export const DREAM_HORIZONS: { value: DreamHorizon; label: string; hint: string }[] = [
  { value: "short", label: "Curto prazo", hint: "até 1 ano" },
  { value: "medium", label: "Médio prazo", hint: "1 a 3 anos" },
  { value: "long", label: "Longo prazo", hint: "3 anos ou mais" },
  { value: "someday", label: "Algum dia", hint: "sem pressa" },
];

export const DREAM_STATUS_LABELS: Record<DreamStatus, string> = {
  dreaming: "Sonhando",
  planning: "Planejando",
  achieved: "Realizado",
};

export function categoryInfo(value: DreamCategory) {
  return DREAM_CATEGORIES.find((c) => c.value === value) ?? DREAM_CATEGORIES.at(-1)!;
}

export function horizonInfo(value: DreamHorizon) {
  return DREAM_HORIZONS.find((h) => h.value === value) ?? DREAM_HORIZONS.at(-1)!;
}
