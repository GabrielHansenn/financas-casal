import {
  BabyIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  CarIcon,
  CircleIcon,
  CoffeeIcon,
  DropletIcon,
  DumbbellIcon,
  FilmIcon,
  FuelIcon,
  GiftIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  HouseIcon,
  LandmarkIcon,
  LaptopIcon,
  PartyPopperIcon,
  PawPrintIcon,
  PiggyBankIcon,
  PillIcon,
  PlaneIcon,
  ReceiptIcon,
  RepeatIcon,
  ShirtIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  TrendingUpIcon,
  UtensilsIcon,
  WalletIcon,
  WifiIcon,
  WrenchIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icons available for categories. Keys are stored in categories.icon (lucide kebab-case names).
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCartIcon,
  utensils: UtensilsIcon,
  coffee: CoffeeIcon,
  house: HouseIcon,
  zap: ZapIcon,
  droplet: DropletIcon,
  wifi: WifiIcon,
  car: CarIcon,
  fuel: FuelIcon,
  bus: BusIcon,
  plane: PlaneIcon,
  "heart-pulse": HeartPulseIcon,
  pill: PillIcon,
  dumbbell: DumbbellIcon,
  "party-popper": PartyPopperIcon,
  film: FilmIcon,
  repeat: RepeatIcon,
  smartphone: SmartphoneIcon,
  "shopping-bag": ShoppingBagIcon,
  shirt: ShirtIcon,
  gift: GiftIcon,
  "graduation-cap": GraduationCapIcon,
  "book-open": BookOpenIcon,
  "paw-print": PawPrintIcon,
  baby: BabyIcon,
  wrench: WrenchIcon,
  receipt: ReceiptIcon,
  briefcase: BriefcaseIcon,
  laptop: LaptopIcon,
  "trending-up": TrendingUpIcon,
  "piggy-bank": PiggyBankIcon,
  landmark: LandmarkIcon,
  wallet: WalletIcon,
  circle: CircleIcon,
};

export const CATEGORY_COLORS = [
  "#22c55e", "#16a34a", "#84cc16", "#eab308", "#f97316", "#ef4444",
  "#ec4899", "#a855f7", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4",
  "#14b8a6", "#8b5cf6", "#64748b", "#78716c",
];

export function CategoryIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon: string;
  color: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const Icon = CATEGORY_ICONS[icon] ?? CircleIcon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "size-6" : "size-8",
        className,
      )}
      // Tinted background derived from the category color (hex + alpha)
      style={{ backgroundColor: `${color}26`, color }}
      aria-hidden
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}
