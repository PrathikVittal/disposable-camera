"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import HowItWorks from "@/app/components/HowItWorks";
import WhyDDC from "@/app/components/WhyDDC";
import Reviews from "@/app/components/Reviews";
import FAQ from "@/app/components/FAQ";
import Pricing from "@/app/components/Pricing";
import Footer from "@/app/components/Footer";

// Two concentric rings of white-framed snapshots on a dark stage. Each photo's
// BOTTOM EDGE is anchored on its ring's circle and the card points RADIALLY
// OUTWARD (not kept upright) — so the cards splay off the ring like a sunburst.
// The rings spin continuously (the `orbit` keyframes) in opposite directions,
// carrying the cards around; legibility isn't the point, the motion is. A radial
// fade to the dark background clears the center for the copy — the "faded area".
const INNER_RING_DURATION = "75s";
const OUTER_RING_DURATION = "95s";

// Ring radii in container-query units (cqmin = 1% of the hero's shorter side),
// so each ring stays a true circle on any aspect ratio.
const INNER_RADIUS = 50;
const OUTER_RADIUS = 85;

const STAGE = "#0D0D0D";

// Nav links — every section except Hero and Footer.
const NAV_LINKS = [
  { label: "How it works?", href: "#how" },
  { label: "Why Us?", href: "#why" },
  { label: "Reviews", href: "#reviews" },
  { label: "FAQs", href: "#faq" },
  { label: "Pricing", href: "#pricing" },
];

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// The CIRCULAR fade that clears the center for the copy, in cqmin (same units as
// the ring radii). It's solid dark out to FADE_SOLID, then fades to transparent
// by FADE_RADIUS — so the inner (bottom) edge of each photo dissolves into the
// dark across that band. Edit both numbers freely.
const FADE_SOLID = 50; // solid dark out to this radius
const FADE_RADIUS = 55; // fully clear (photos fully visible) at this radius

// Every card is one of two exact shapes (Figma dev-mode measurements at the lg
// tier; base/md scale down 0.6x/0.8x, same aspect ratio):
//   rect: 90 x 120 (3:4)    square: 120 x 120 (1:1)
const RECT_SIZE = "w-[54px] h-[72px] md:w-[72px] md:h-[96px] lg:w-[90px] lg:h-[120px]";
const SQUARE_SIZE = "w-[72px] h-[72px] md:w-[96px] md:h-[96px] lg:w-[120px] lg:h-[120px]";

const OUTER_RING_CARDS = [
  { rotate: -10, shape: "rect", name: "outer1" },
  { rotate: 6, shape: "square", name: "outer2" },
  { rotate: -8, shape: "rect", name: "outer3" },
  { rotate: 10, shape: "square", name: "outer4" },
  { rotate: -6, shape: "rect", name: "outer5" },
  { rotate: 9, shape: "square", name: "outer6" },
  { rotate: -10, shape: "rect", name: "outer7" },
  { rotate: 7, shape: "square", name: "outer8" },
  { rotate: -6, shape: "rect", name: "outer9" },
  { rotate: 9, shape: "square", name: "outer10" },
  { rotate: -8, shape: "rect", name: "outer11" },
  { rotate: 11, shape: "square", name: "outer12" },
];

const INNER_RING_CARDS = [
  { rotate: 8, shape: "square", name: "inner1" },
  { rotate: -7, shape: "rect", name: "inner2" },
  { rotate: 9, shape: "square", name: "inner3" },
  { rotate: -9, shape: "rect", name: "inner4" },
  { rotate: 6, shape: "square", name: "inner5" },
  { rotate: -8, shape: "rect", name: "inner6" },
  { rotate: 9, shape: "square", name: "inner7" },
  { rotate: -6, shape: "rect", name: "inner8" },
  { rotate: 7, shape: "square", name: "inner9" },
  { rotate: -9, shape: "rect", name: "inner10" },
  { rotate: 8, shape: "square", name: "inner11" },
  { rotate: -10, shape: "rect", name: "inner12" },
];

function PhotoRing({
  cards,
  radius,
  duration,
  reverse = false,
}: {
  cards: typeof OUTER_RING_CARDS;
  radius: number;
  duration: string;
  reverse?: boolean;
}) {
  const n = cards.length;
  return (
    // Zero-size pivot at the hero center; the inner div spins the whole ring.
    <div className="absolute" style={{ top: "50%", left: "50%", width: 0, height: 0 }}>
      <div
        className="absolute"
        style={{
          top: 0,
          left: 0,
          animation: `orbit ${duration} linear infinite${reverse ? " reverse" : ""}`,
        }}
      >
        {cards.map((c, k) => {
          // Evenly spaced around the circle, starting at the top.
          const angleDeg = -90 + (k * 360) / n;
          const angle = angleDeg * (Math.PI / 180);
          const cos = Math.cos(angle).toFixed(4);
          const sin = Math.sin(angle).toFixed(4);
          // Point the card radially outward so its bottom edge lies flush on the
          // ring (+ a small per-card tilt). Baked statically: as the ring spins,
          // the card revolves while always pointing away from center.
          const radialDeg = ((k * 360) / n + c.rotate).toFixed(1);
          return (
            <div
              key={k}
              className="absolute"
              style={{
                top: 0,
                left: 0,
                // Move this card's anchor point onto the ring (true circle via cqmin).
                transform: `translate(calc(${cos} * ${radius}cqmin), calc(${sin} * ${radius}cqmin))`,
              }}
            >
              <div
                className={`bg-white pt-[3px] px-[3px] pb-[6px] md:pt-[4px] md:px-[4px] md:pb-[8px] lg:pt-[4.8px] lg:px-[4.8px] lg:pb-[9.6px] shadow-[0_10px_28px_rgba(0,0,0,0.55)] ${c.shape === "square" ? SQUARE_SIZE : RECT_SIZE}`}
                style={{
                  // Anchor the card's BOTTOM-CENTER on the ring point, rotated to
                  // point radially outward.
                  transform: `translate(-50%, -100%) rotate(${radialDeg}deg)`,
                  transformOrigin: "50% 100%",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/hero-photos/${c.name}.jpg`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const navGlass = {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.02))",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 0 0 1px rgba(255,255,255,0.10), 0 14px 44px rgba(0,0,0,0.45)",
  };

  // Close the mobile menu on any touch/click outside the nav (the pill + the
  // dropdown panel below it) — e.g. tapping the page content behind it.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Nav — floating dark glass pill */}
      <nav ref={navRef} className="fixed top-3 left-0 right-0 z-50 px-[15px] md:px-6">
        <div
          className="mx-auto flex max-w-[1100px] items-center justify-between rounded-full px-4 md:px-6 py-2.5 md:py-3 backdrop-blur-2xl"
          style={navGlass}
        >
          <Link href="/" onClick={scrollToTop} className="flex items-center gap-2.5">
            <span className="h-6 w-6 rounded-full" style={{ background: "#4F46E5" }} />
            <span className="font-bebas text-[16px] md:text-[20px] font-[800] tracking-[0.16em] text-white">
              DDC
            </span>
          </Link>
          <div className="hidden items-center gap-7 text-[14px] font-[600] text-[#cfcfcf] md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-white">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-full px-4 md:px-5 py-2 md:py-2.5 text-[12px] md:text-[15px] font-[700] text-white"
              style={{ background: "#4F46E5" }}
            >
              Get started for free
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white md:hidden"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Mobile menu — opens below the pill, same section links as desktop */}
        {menuOpen && (
          <div
            className="mx-auto mt-2 max-w-[1100px] overflow-hidden rounded-3xl backdrop-blur-2xl md:hidden"
            style={navGlass}
          >
            <div className="flex flex-col px-6 py-2">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-white/10 py-3.5 text-[15px] font-[600] text-[#cfcfcf] last:border-0 hover:text-white"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero — two concentric rings of photos on a dark stage.
          `hero-scroll-fade` dissolves the whole hero into the background as you
          scroll toward "How it works" (scroll-driven, see globals.css). */}
      <section
        className="hero-scroll-fade relative mt-8 md:mt-12 h-[560px] sm:h-[640px] md:h-[780px] lg:h-[860px] overflow-hidden"
        style={{
          containerType: "size",
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          background: STAGE,
        }}
      >
        {/* Two rings, each spinning slowly — fade/zoom in on load.
            The mask fades the PHOTOS THEMSELVES to transparent toward the bottom
            (and a touch at the top), so ring cards dissolve into the stage instead
            of being hard-clipped by overflow-hidden — no bright clipped edge / line
            at the seam. */}
        <div
          className="hero-rings-in absolute inset-0 pointer-events-none"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0, #000 6%, #000 62%, transparent 90%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0, #000 6%, #000 62%, transparent 90%)",
          }}
        >
          <PhotoRing cards={OUTER_RING_CARDS} radius={OUTER_RADIUS} duration={OUTER_RING_DURATION} reverse />
          <PhotoRing cards={INNER_RING_CARDS} radius={INNER_RADIUS} duration={INNER_RING_DURATION} />
          {/* Circular fade to the stage colour: clears the center for the copy
              and softens photos as they approach it (the "faded area"). Its size
              is FADE_RADIUS (cqmin) — change that one constant to resize it. */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle ${FADE_RADIUS}cqmin at 50% 49%, #0D0D0D 0, #0D0D0D ${FADE_SOLID}cqmin, rgba(13,13,13,0) ${FADE_RADIUS}cqmin)`,
            }}
          />
        </div>

        {/* Centered copy — each line rises in on load (staggered) */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-[15px] text-center">
          <p
            className="hero-rise font-bebas text-[14px] md:text-[20px] font-[800] tracking-[0.2em] uppercase text-white"
            style={{ "--rise-delay": "0.2s" } as React.CSSProperties}
          >
            DDC
          </p>
          <h1
            className="hero-rise font-bebas text-[34px] md:text-[56px] font-[800] tracking-[-0.03em] leading-[1.05] text-white"
            style={{ "--rise-delay": "0.32s" } as React.CSSProperties}
          >
            Capture<br />
            every perspective
          </h1>
          <p
            className="hero-rise text-[12px] md:text-[16px] text-[#9a9a9a] leading-[1.6] mt-3 max-w-[280px] md:max-w-[360px]"
            style={{ "--rise-delay": "0.46s" } as React.CSSProperties}
          >
            Turn every guest into a photographer.<br />
            No app. No login. Just scan, snap, and share.
          </p>
          <div
            className="hero-rise flex gap-3 mt-5"
            style={{ "--rise-delay": "0.58s" } as React.CSSProperties}
          >
            <Link
              href="/dashboard"
              className="bg-white text-black text-[12px] md:text-[16px] font-[800] tracking-[0.08em] uppercase rounded-full px-6 md:px-8 py-[11px] md:py-[13px]"
            >
              Create event
            </Link>
            <a
              href="#how"
              className="border-[1.5px] border-white/70 text-white text-[12px] md:text-[16px] font-[700] tracking-[0.08em] uppercase rounded-full px-6 md:px-8 py-[10px] md:py-[12px]"
            >
              How?
            </a>
          </div>
        </div>
      </section>

      {/* How it works — Host / Guest toggle + stepped phone mockups */}
      <HowItWorks />

      {/* Why DDC — two cropped phones, side by side */}
      <WhyDDC />

      {/* Loved by event hosts — horizontally scrolling review cards */}
      <Reviews />

      {/* FAQ — accordion */}
      <FAQ />

      {/* Pricing — three tiers */}
      <Pricing />

      {/* Final CTA — sits between Pricing and the footer */}
      <section className="px-[15px] md:px-10 lg:px-16 pb-16 md:pb-20">
        <Link
          href="/dashboard"
          className="mx-auto block max-w-[1080px] rounded-full py-[14px] text-center font-bebas text-[15px] md:text-[24px] font-[800] tracking-[0.06em] uppercase text-white"
          style={{ background: "#4F46E5" }}
        >
          Get started &mdash; it&apos;s free
        </Link>
      </section>

      {/* Footer — policy links + oversized wordmark */}
      <Footer />
    </div>
  );
}
