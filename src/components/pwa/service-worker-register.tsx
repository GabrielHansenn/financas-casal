"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production builds only (in development it would serve stale assets
 * across hot reloads). updateViaCache "none" makes the browser always check for a new worker.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.error("[pwa] service worker registration failed", error);
    });
  }, []);

  return null;
}
