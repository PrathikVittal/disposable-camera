"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Dev only ever hurts here: Turbopack reuses chunk URLs across rebuilds,
    // so the SW's cache-first /_next/static handling serves stale JS on a
    // normal reload (only a forced reload bypasses the SW, which is why that
    // "fixed" it). Production builds use content-hashed chunk URLs, so the
    // same strategy is safe there.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker?.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  return null;
}
