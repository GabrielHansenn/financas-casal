import { EllipsisIcon, HeartHandshakeIcon, HouseIcon, ReceiptTextIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: "/" | "/transacoes" | "/casal" | "/mais";
  label: string;
  icon: LucideIcon;
};

// Primary navigation: bottom bar on mobile, sidebar on desktop
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: HouseIcon },
  { href: "/transacoes", label: "Transações", icon: ReceiptTextIcon },
  { href: "/casal", label: "Casal", icon: HeartHandshakeIcon },
  { href: "/mais", label: "Mais", icon: EllipsisIcon },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
