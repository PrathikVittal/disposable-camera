"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import Link from "next/link";

const ACCENT = "#4F46E5";

type Plan = {
  name: string;
  price: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    features: [
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
    ],
    cta: { label: "Start for free", href: "/dashboard" },
  },
  {
    name: "Plus",
    price: "$49",
    features: [
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
    ],
    cta: { label: "Subscribe", href: "/dashboard" },
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: [
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
      "Lorem ipsum dolor sit amet",
    ],
    cta: { label: "Request trial", href: "/dashboard" },
  },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-white/70" aria-hidden>
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PriceLabel({ price }: { price: string }) {
  if (price.startsWith("$")) {
    return (
      <p className="flex items-baseline gap-2 text-white">
        <span className="font-bebas text-[24px] md:text-[40px] font-[800]">$</span>
        <span className="font-bebas text-[24px] md:text-[40px] font-[800] leading-none tracking-[-0.02em]">{price.slice(1)}</span>
      </p>
    );
  }
  return <p className="font-bebas text-[24px] md:text-[40px] font-[800] uppercase leading-none tracking-[-0.02em] text-white">{price}</p>;
}

// Per-plan background/shadow — shared by the desktop grid and the mobile stack.
function planStyle(plan: Plan) {
  return plan.highlight
    ? {
      background: "linear-gradient(180deg, #2a2470 0%, #1c1856 55%, #15123f 100%)",
      boxShadow: "0 24px 70px rgba(79,70,229,0.30)",
    }
    : { background: "#171717" };
}

// Heading — shared by mobile (pinned) and desktop layouts.
function PricingHeading() {
  return (
    <h2 className="text-center font-bebas text-[34px] md:text-[56px] font-[800] uppercase tracking-[-0.02em] leading-[0.95]">
      Pricing
    </h2>
  );
}

// The inner card content (everything inside the rounded panel). The wrapper —
// which carries the background and rounding — differs between desktop (grid
// cell) and mobile (stacking motion.div), so it's kept out of here.
function PlanContent({ plan }: { plan: Plan }) {
  return (
    <>
      <h3 className="font-bebas text-[16px] md:text-[24px] font-[800] uppercase tracking-[0.02em] text-white">
        {plan.name}
      </h3>
      <div className="my-5 h-px bg-white/12" />
      <PriceLabel price={plan.price} />
      <div className="my-5 h-px bg-white/12" />

      <ul className="flex flex-col gap-4">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-[14px] md:text-[16px] text-[#cfcfcf]">
            <Check />
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={plan.cta.href}
        className={`mt-10 rounded-2xl py-3.5 text-center text-[14px] md:text-[16px] font-[700] ${plan.highlight ? "text-white" : "bg-white text-black"
          }`}
        style={plan.highlight ? { background: ACCENT } : undefined}
      >
        {plan.cta.label}
      </Link>
    </>
  );
}

// ── Mobile-only pinned card stack ─────────────────────────────────────────────
// Same behaviour (and the exact same knob values) as the How it works section:
// the heading is pinned to the top of the viewport and the first card sits
// below it; as you scroll, cards 2..n slide UP and pile on, each leaving a
// STACK_PEEK-tall lip of the card it covers. Positions are driven by scroll
// PROGRESS through a tall "track", so the finished stack HOLDS before the whole
// section unpins together. Keep these in sync with HowItWorks.tsx.
const STACK_PEEK = 20; // visible px of each buried card after the next stacks on it
const STACK_ENTER_DROP = 480; // px below its resting spot a card starts, before sliding up
const STACK_SCROLL_PER_CARD = 80; // scroll distance (vh) for ONE card to slide up & stack
const STACK_MOVE = 0.85; // fraction of that distance spent moving (the rest is a dwell)
const STACK_HOLD = 2; // scroll distance (vh) the finished stack holds before release

function PricingStackCard({
  plan,
  index,
  count,
  progress,
}: {
  plan: Plan;
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
  // transition, moving for STACK_MOVE of it then dwelling. Anchor maps to flat 0.
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
      className="absolute inset-x-0 mx-auto flex w-full max-w-[360px] origin-top flex-col rounded-3xl p-6 pb-7 ring-1 ring-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
      style={{ y, top: 0, zIndex: index, willChange: "transform", backfaceVisibility: "hidden", ...planStyle(plan) }}
    >
      <PlanContent plan={plan} />
    </motion.div>
  );
}

function MobilePricing() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const transitions = PLANS.length - 1;
  // Track height = one viewport (the pinned frame) + the scroll budget that keeps
  // it pinned while the cards stack and then hold.
  const trackVh = 100 + transitions * STACK_SCROLL_PER_CARD + STACK_HOLD;

  return (
    <div ref={trackRef} className="md:hidden" style={{ height: `${trackVh}vh` }}>
      {/* Pinned frame: heading + first card stay put; cards 2..n slide up */}
      <div className="sticky top-0 flex h-screen flex-col items-center pt-[80px]">
        <PricingHeading />
        <div className="relative mt-10 w-full flex-1">
          {PLANS.map((plan, i) => (
            <PricingStackCard
              key={plan.name}
              plan={plan}
              index={i}
              count={PLANS.length}
              progress={scrollYProgress}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="px-[15px] md:px-10 lg:px-16 md:py-28">
      {/* MOBILE — pinned heading + stacking plan cards */}
      <MobilePricing />

      {/* DESKTOP — unchanged three-column grid */}
      <div className="hidden md:block">
        <PricingHeading />
        <div className="mx-auto mt-12 grid max-w-[1080px] gap-5 md:mt-16 md:grid-cols-3 md:gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-3xl p-7 ring-1 ring-white/10"
              style={planStyle(plan)}
            >
              <PlanContent plan={plan} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
