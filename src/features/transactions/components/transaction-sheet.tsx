"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/** Bottom sheet on mobile, side panel on desktop. Children mount only while open. */
export function TransactionSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn(
          "gap-0 overflow-y-auto",
          isDesktop ? "w-full sm:max-w-md" : "max-h-[92dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so each opening starts with fresh state */}
        <div className="px-4 pb-6">{open ? children : null}</div>
      </SheetContent>
    </Sheet>
  );
}
