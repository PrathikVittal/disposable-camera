"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import Lenis from "lenis";

// Smooth-scroll "sensitivity", 1–10. Lenis interpolates real scrollY toward
// your wheel input each frame instead of jumping straight there; this controls
// how quickly it catches up. 1 = heavy lag (very smooth, slow to settle),
// 10 = catches up almost immediately (snappy, barely perceptible smoothing).
// It maps to Lenis's `lerp` (0–1): tune the number below and refeel it.
const SCROLL_SENSITIVITY = 10;
const LENIS_LERP = 0.05 + (SCROLL_SENSITIVITY / 10) * 0.45;

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // The browser restores scroll position on a manual reload by default,
    // which fights the hero's load-in/scroll-fade animations. Reset it so
    // every reload starts at the top, like a fresh navigation would.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    // Lenis smooths real window.scrollY (not a transform trick), so the
    // hero's CSS scroll-driven fade and the How it works / Pricing
    // framer-motion useScroll progress all keep working unchanged — they
    // just read a smoothed scroll position instead of the raw jumpy one.
    // syncTouch is off so phones keep native momentum-scroll feel.
    const lenis = new Lenis({
      lerp: LENIS_LERP,
      smoothWheel: true,
      syncTouch: false,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
