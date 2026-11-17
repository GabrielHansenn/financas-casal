"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActivePath, MANAGE_ITEMS, NAV_ITEMS } from "./nav-items";

function SidebarLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

// Desktop sidebar: primary navigation plus the "Gerenciar" shortcuts (on mobile they live in Mais)
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="grid gap-6">
      <ul className="grid gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <SidebarLink {...item} active={isActivePath(pathname, item.href)} />
          </li>
        ))}
      </ul>

      <div className="grid gap-1">
        <p id="sidebar-manage" className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Gerenciar
        </p>
        <ul className="grid gap-1" aria-labelledby="sidebar-manage">
          {MANAGE_ITEMS.map((item) => (
            <li key={item.href}>
              <SidebarLink {...item} active={isActivePath(pathname, item.href)} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
