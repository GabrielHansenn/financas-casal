"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { QuickAddData } from "../types";
import { TransactionForm } from "./transaction-form";

// Positioned above the mobile bottom nav (4rem + safe area) and in the corner on desktop
const FAB_POSITION =
  "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 md:right-8 md:bottom-8";

export function QuickAddButton({ data }: { data: QuickAddData }) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <>
      <Button
        size="icon-lg"
        onClick={() => setOpen(true)}
        className={cn(FAB_POSITION, "size-14 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-6")}
        aria-label="Novo lançamento"
      >
        <PlusIcon />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          className={cn(
            "gap-0 overflow-y-auto",
            isDesktop ? "w-full sm:max-w-md" : "max-h-[92dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <SheetHeader>
            <SheetTitle>Novo lançamento</SheetTitle>
            <SheetDescription className="sr-only">
              Informe o valor, escolha a categoria e salve.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {/* Mounted only while open, so each opening starts with fresh defaults */}
            {open ? <TransactionForm data={data} onDone={() => setOpen(false)} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Placeholder shown while the quick-add data streams in. */
export function QuickAddButtonFallback() {
  return (
    <Button
      size="icon-lg"
      disabled
      className={cn(FAB_POSITION, "size-14 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-6")}
      aria-label="Novo lançamento"
    >
      <PlusIcon />
    </Button>
  );
}
