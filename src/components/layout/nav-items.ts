import {
  CalendarClockIcon,
  EllipsisIcon,
  HeartHandshakeIcon,
  HouseIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  SparklesIcon,
  TagsIcon,
  TargetIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: "/" | "/transacoes" | "/sonhos" | "/casal" | "/mais";
  label: string;
  icon: LucideIcon;
};

// Primary navigation: bottom bar on mobile, sidebar on desktop
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: HouseIcon },
  { href: "/transacoes", label: "Transações", icon: ReceiptTextIcon },
  { href: "/sonhos", label: "Sonhos", icon: SparklesIcon },
  { href: "/casal", label: "Casal", icon: HeartHandshakeIcon },
  { href: "/mais", label: "Mais", icon: EllipsisIcon },
];

export type ManageItem = {
  href: "/metas" | "/recorrencias" | "/contas" | "/categorias" | "/workspaces";
  label: string;
  icon: LucideIcon;
};

// "Gerenciar" section: listed on the Mais page and, on desktop, in the sidebar
export const MANAGE_ITEMS: ManageItem[] = [
  { href: "/metas", label: "Metas", icon: TargetIcon },
  { href: "/recorrencias", label: "Recorrências", icon: CalendarClockIcon },
  { href: "/contas", label: "Contas", icon: LandmarkIcon },
  { href: "/categorias", label: "Categorias", icon: TagsIcon },
  { href: "/workspaces", label: "Workspaces e convites", icon: UsersIcon },
];

export function isActivePath(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** On mobile the "Gerenciar" pages are reached through Mais, so Mais stays highlighted there. */
export function isActiveTab(pathname: string | null, href: NavItem["href"]): boolean {
  if (href === "/mais" && MANAGE_ITEMS.some((item) => isActivePath(pathname, item.href))) return true;
  return isActivePath(pathname, href);
}
