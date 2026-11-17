"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { todayISO } from "@/lib/dates";
import { runDueRecurrences } from "../actions";

const RUN_KEY = "recurrences:last-run";
// Module-level guard: effects run twice in development (Strict Mode)
let started = false;

/**
 * Generates due recurring transactions when the app opens: once per browser session and day.
 * The server is idempotent, so an extra run (another tab, the partner's phone) is harmless.
 */
export function RecurrenceRunner() {
  const router = useRouter();

  useEffect(() => {
    if (started) return;
    started = true;

    const today = todayISO();
    try {
      if (window.sessionStorage.getItem(RUN_KEY) === today) return;
    } catch {
      // storage unavailable: run anyway
    }

    runDueRecurrences()
      .then((result) => {
        try {
          window.sessionStorage.setItem(RUN_KEY, today);
        } catch {
          // ignore
        }
        if (result.created > 0) {
          toast.success(
            result.created === 1
              ? "1 lançamento recorrente foi criado"
              : `${result.created} lançamentos recorrentes foram criados`,
          );
          router.refresh();
        }
        if (result.failed > 0) {
          toast.warning("Uma recorrência não pôde ser lançada. Confira em Mais → Recorrências.", { duration: 8000 });
        }
      })
      .catch(() => {
        started = false; // network error: try again on the next navigation that mounts this
      });
  }, [router]);

  return null;
}
