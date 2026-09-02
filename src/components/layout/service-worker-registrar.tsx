"use client";

import { useEffect } from "react";

/**
 * Registers the EsiFit service worker (PWA offline shell + update flow).
 * The SW itself never caches POST/mutation traffic; offline writes are
 * queued in IndexedDB by the offline adapter instead.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // In dev the SW would fight HMR; only register in production builds.
      return;
    }
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Non-fatal: app remains fully usable online without SW.
      }
    };
    register();
  }, []);

  return null;
}
