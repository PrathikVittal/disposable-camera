"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

const ACCENT = "#4F46E5";

// ── Step content ────────────────────────────────────────────────────────────
// Per-step screen images go at public/how/<mode>-<n>.jpg (e.g. host-1.jpg).
// They render inside the phone screen; until you add them the screen stays a
// clean white card with the step number. Edit the copy below freely.
type Step = {
  n: string;
  body: string;
  img: string;
};

const HOST_STEPS: Step[] = [
  {
    n: "01",
    body: "Personalise your event with a custom cover, event details, upload settings, photo limits, gallery privacy, and more — all in just a few clicks.",
    img: "/how/host-1.jpg",
  },
  {
    n: "02",
    body: "Share one QR code or link. Guests join instantly — no app download, no account, no friction.",
    img: "/how/host-2.jpg",
  },
  {
    n: "03",
    body: "Watch the live gallery fill up in real time, moderate if you like, then download every shot in full resolution.",
    img: "/how/host-3.jpg",
  },
];

const GUEST_STEPS: Step[] = [
  {
    n: "01",
    body: "Scan the host's QR code or tap their link. The camera opens right in your browser — nothing to install.",
    img: "/how/guest-1.jpg",
  },
  {
    n: "02",
    body: "Snap your shots with the in-browser disposable camera. Every angle, from every guest.",
    img: "/how/guest-2.jpg",
  },
  {
    n: "03",
    body: "See the whole night come together in one shared live gallery as everyone keeps shooting.",
    img: "/how/guest-3.jpg",
  },
];

function HostIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GuestIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z"
        clipRule="evenodd"
      />
      <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
    </svg>
  );
}

// One phone — built in CSS to match the reference (rounded bezel, notch, white
// screen, big step number). To use YOUR transparent PNG bezel instead, drop it
// at public/phone-bezel.png and overlay it with an <img className="absolute
// inset-0" />, then nudge the screen insets to match its window.
function PhoneMockup({ step, width }: { step: Step; width?: number }) {
  return (
    // Aspect matches the trimmed bezel PNG (1142 x 2323). `width` overrides the
    // default max-width (used by the smaller mobile stack cards below).
    <div
      className="relative mx-auto w-full max-w-[300px]"
      style={{ aspectRatio: "1142 / 2323", ...(width ? { maxWidth: width } : {}) }}
    >
      {/* Screen content sits BEHIND the transparent PNG bezel; the frame and the
          notch (baked into the PNG) overlay it. Stays clean white until you drop
          a screen image at the step's img path. Masked to the bezel's exact screen
          window (phone-screen-mask.png) so the white never bleeds past the frame. */}
      <div
        className="absolute inset-0 overflow-hidden bg-white"
        style={{
          WebkitMaskImage: "url(/phone-screen-mask.png)",
          maskImage: "url(/phone-screen-mask.png)",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={step.img}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {/* Big step-number watermark */}
        <span
          className="pointer-events-none absolute bottom-[3%] left-1/2 -translate-x-1/2 font-bebas text-[80px] font-[800] leading-none"
          style={{ color: ACCENT, opacity: 0.16 }}
        >
          {step.n}
        </span>
      </div>
      {/* The transparent phone-bezel PNG (frame + notch) on top */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phone-bezel.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}

// Section heading + Host/Guest toggle, shared by the mobile (pinned) and the
// desktop (normal-flow) layouts. TABS is static so it lives at module scope.
const TABS = [
  { key: "host" as const, label: "Host", Icon: HostIcon },
  { key: "guest" as const, label: "Guest", Icon: GuestIcon },
];

function SectionHeading() {
  return (
    <h2 className="text-center font-bebas text-[34px] md:text-[56px] font-[800] uppercase tracking-[-0.02em] leading-[0.95]">
      How DDC Works?
    </h2>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: "host" | "guest";
  setMode: (m: "host" | "guest") => void;
}) {
  return (
    <div className="mt-5 flex justify-center md:mt-9">
      <div
        className="inline-flex items-center gap-1 rounded-full p-1.5 backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06))",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.30), inset 0 0 0 1px rgba(255,255,255,0.10), 0 12px 30px rgba(0,0,0,0.55)",
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-full px-7 py-2.5 text-[15px] font-[700] transition-colors ${active
                ? "text-white shadow-[0_2px_10px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.25)]"
                : "text-[#cfcfcf] hover:text-white"
                }`}
              style={active ? { background: ACCENT } : undefined}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mobile-only pinned card stack (desktop keeps the side-by-side grid below) ─
// The heading + toggle + first card are pinned to the top of the viewport; as
// you scroll, cards 2..n slide UP from below and pile on, each leaving a
// STACK_PEEK-tall coloured lip of the card it covers. Positions are driven by
// scroll PROGRESS through a tall "track", so timing is exact: each card gets
// the same slide-in budget, the finished stack HOLDS, then the whole section
// unpins together (no per-card sticky release weirdness).
//
// NOTE: the phone shows the top 2/3 of /phone-bezel.png (clipped). When a
// dedicated 2/3-cropped PNG is dropped in, swap PhoneMockup's src and set
// STACK_VISIBLE to 1.
const STACK_PHONE_W = 200; // phone width inside each card, px
const STACK_BEZEL_RATIO = 2323 / 1142; // full bezel aspect (h/w)
const STACK_VISIBLE = 2 / 3; // fraction of the bezel height that's shown
const STACK_PHONE_CROP_H = STACK_PHONE_W * STACK_BEZEL_RATIO * STACK_VISIBLE;

// ── Stacking knobs ───────────────────────────────────────────────────────────
// STACK_PEEK is the headline one: after a card stacks on top of another, this
// many PIXELS of the buried card stay visible (its coloured lip at the top).
const STACK_PEEK = 20; // visible px of each buried card after the next stacks on it
const STACK_ENTER_DROP = 500; // px below its resting spot a card starts, before sliding up
// Scroll budget (in vh) — controls how long the section stays pinned:
const STACK_SCROLL_PER_CARD = 80; // scroll distance for ONE card to slide up & stack
const STACK_MOVE = 0.85; // fraction of that distance spent moving (the rest is a dwell)
const STACK_HOLD = 5; // scroll distance the finished stack holds before the section releases

// Light pastel card colours, one per step (cycles if there are more steps).
const STACK_PASTELS = ["#ECE7FF", "#E2F7EC", "#FFE9DD"];
const STACK_TEXT = "#23262F"; // caption colour — dark, for contrast on the pastels

function StackCard({
  step,
  index,
  count,
  progress,
}: {
  step: Step;
  index: number;
  count: number;
  progress: MotionValue<number>;
}) {
  const isAnchor = index === 0; // card 0 never moves — it's the anchor
  const transitions = count - 1;
  const pinnedUnits = transitions * STACK_SCROLL_PER_CARD + STACK_HOLD;

  // Resting spot: each card sits STACK_PEEK lower than the one before it.
  const restY = index * STACK_PEEK;

  // Slide-in window (in scroll fractions). Card i animates during the i-th
  // transition, moving for STACK_MOVE of it then dwelling. Anchor maps to a flat 0.
  const winStart = isAnchor ? 0 : ((index - 1) * STACK_SCROLL_PER_CARD) / pinnedUnits;
  const winEnd = isAnchor
    ? 1
    : ((index - 1) * STACK_SCROLL_PER_CARD + STACK_SCROLL_PER_CARD * STACK_MOVE) / pinnedUnits;
  const y = useTransform(
    progress,
    [winStart, winEnd],
    [isAnchor ? 0 : restY + STACK_ENTER_DROP, restY],
  );

  return (
    <motion.div
      className="absolute inset-x-0 mx-auto w-full max-w-[300px] origin-top rounded-[30px] p-5 pb-6 shadow-[0_12px_30px_rgba(0,0,0,0.55)] ring-1 ring-black/5"
      style={{
        y,
        top: 0,
        zIndex: index,
        willChange: "transform",
        backfaceVisibility: "hidden",
        backgroundColor: STACK_PASTELS[index % STACK_PASTELS.length],
      }}
    >
      {/* Phone (top 2/3 of the bezel) */}
      <div
        className="mx-auto overflow-hidden"
        style={{ width: STACK_PHONE_W, height: STACK_PHONE_CROP_H }}
      >
        <PhoneMockup step={step} width={STACK_PHONE_W} />
      </div>
      {/* Caption — inside the pastel card */}
      <p
        className="mt-4 text-center text-[15px] font-[500] leading-[1.55]"
        style={{ color: STACK_TEXT }}
      >
        {step.body}
      </p>
    </motion.div>
  );
}

function MobileHow({
  steps,
  mode,
  setMode,
}: {
  steps: Step[];
  mode: "host" | "guest";
  setMode: (m: "host" | "guest") => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const transitions = steps.length - 1;
  // Track height = one viewport (the pinned frame) + the scroll budget that keeps
  // it pinned while the cards stack and then hold.
  const trackVh = 100 + transitions * STACK_SCROLL_PER_CARD + STACK_HOLD;

  return (
    <div ref={trackRef} className="md:hidden" style={{ height: `${trackVh}vh` }}>
      {/* Pinned frame: heading + toggle + first card stay put; cards 2..n slide up */}
      <div className="sticky top-0 flex h-screen flex-col items-center pt-[87px]">
        <SectionHeading />
        <ModeToggle mode={mode} setMode={setMode} />
        <div className="relative mt-5 w-full flex-1">
          {steps.map((step, i) => (
            <StackCard
              key={step.n}
              step={step}
              index={i}
              count={steps.length}
              progress={scrollYProgress}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const [mode, setMode] = useState<"host" | "guest">("host");
  const steps = mode === "host" ? HOST_STEPS : GUEST_STEPS;

  return (
    <section id="how" className="px-[15px] md:px-10 lg:px-16 md:py-28">
      {/* MOBILE — pinned heading + toggle + stacking cards */}
      <MobileHow steps={steps} mode={mode} setMode={setMode} />

      {/* DESKTOP — unchanged side-by-side grid */}
      <div className="hidden md:block">
        <SectionHeading />
        <ModeToggle mode={mode} setMode={setMode} />
        <div className="mx-auto mt-14 max-w-[1080px] space-y-16 md:space-y-24">
          {steps.map((step) => (
            <div
              key={step.n}
              className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
            >
              <PhoneMockup step={step} />
              <div>
                <p className="text-[20px] font-[600] leading-[1.3] text-white">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
