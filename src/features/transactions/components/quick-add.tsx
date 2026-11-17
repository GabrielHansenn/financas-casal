"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuickAddData } from "../types";
import { TransactionForm } from "./transaction-form";
import { TransactionSheet } from "./transaction-sheet";

// Positioned above the mobile bottom nav (4rem + safe area) and in the corner on desktop
const FAB_CLASS =
  "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg md:right-8 md:bottom-8 [&_svg:not([class*='size-'])]:size-6";

export function QuickAddButton({ data }: { data: QuickAddData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="icon-lg" onClick={() => setOpen(true)} className={FAB_CLASS} aria-label="Novo lançamento">
        <PlusIcon />
      </Button>

      <TransactionSheet
        open={open}
        onOpenChange={setOpen}
        title="Novo lançamento"
        description="Informe o valor, escolha a categoria e salve."
      >
        <TransactionForm data={data} onDone={() => setOpen(false)} />
      </TransactionSheet>
    </>
  );
}

/** Placeholder shown while the quick-add data streams in. */
export function QuickAddButtonFallback() {
  return (
    <Button size="icon-lg" disabled className={FAB_CLASS} aria-label="Novo lançamento">
      <PlusIcon />
    </Button>
  );
}
