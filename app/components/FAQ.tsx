"use client";

// FAQ — accordion. One item open at a time; the open item gets a raised dark
// panel, closed items are flat rows separated by hairlines.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const FAQS = [
  {
    q: "How's it possible that guests don't have to download the app?",
    a: "DDC uses a web-based experience. This lets others join your camera directly from a link or QR Code, without having to download an app from the App Store or Play Store.",
  },
  {
    q: "Can guests join from any device or platform?",
    a: "Yes — any modern smartphone or laptop with a browser works. iOS, Android, or desktop, there's nothing to install and no account to create.",
  },
  {
    q: "Is there any limit to how many guests can join without the app?",
    a: "No hard limit. Hundreds of guests can join the same event and upload to the shared gallery at the same time.",
  },
  {
    q: "How secure is the web-based experience for guests?",
    a: "Every event is private by default. Only people with your link or QR code can join, and you stay in control of gallery visibility, approvals, and downloads.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="px-[15px] md:px-10 lg:px-16 py-20 md:py-28">
      <h2 className="text-center font-bebas text-[34px] md:text-[56px] font-[800] uppercase tracking-[-0.02em] leading-[0.95]">
        FAQ
      </h2>

      <div className="mx-auto mt-12 max-w-[1080px] md:mt-16">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={
                isOpen
                  ? "rounded-2xl bg-[#181818] px-5 md:px-7 ring-1 ring-white/10"
                  : "border-b border-white/10 px-5 md:px-7"
              }
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-6 py-6 text-left"
              >
                <span className="font-bebas text-[14px] md:text-[20px] font-[800] uppercase tracking-[0.01em] text-white">
                  {item.q}
                </span>
                <span className="relative h-5 w-5 shrink-0 text-white">
                  {/* horizontal bar (always) + vertical bar (only when closed) = +/− */}
                  <span className="absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 rounded bg-current" />
                  <span
                    className={`absolute left-1/2 top-0 h-5 w-[2px] -translate-x-1/2 rounded bg-current transition-opacity ${isOpen ? "opacity-0" : "opacity-100"
                      }`}
                  />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="pb-6 text-[14px] md:text-[16px] leading-[1.6] text-[#9a9a9a]">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
