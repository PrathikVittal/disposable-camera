"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // The browser restores scroll position on a manual reload by default,
    // which fights the hero's load-in/scroll-fade animations. Reset it so
    // every reload starts at the top, like a fresh navigation would.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
