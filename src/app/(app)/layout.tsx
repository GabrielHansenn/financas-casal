import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarUserSlot, WorkspaceSwitcherSlot } from "@/components/layout/shell-slots";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Skeleton } from "@/components/ui/skeleton";

// Authenticated shell. Everything here is static (prerendered) except the session-dependent
// slots, which stream in behind their own Suspense boundaries so navigation stays instant.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <Brand className="px-2 pt-1" />
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <WorkspaceSwitcherSlot className="w-full" />
        </Suspense>
        <SidebarNav />
        <div className="mt-auto">
          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <SidebarUserSlot />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
          <Suspense fallback={<Skeleton className="h-10 w-44" />}>
            <WorkspaceSwitcherSlot className="max-w-[70vw]" />
          </Suspense>
        </header>

        {/* Bottom padding keeps content clear of the mobile bottom nav */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-10 md:pb-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
