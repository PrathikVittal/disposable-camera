"use client";

// "Loved by event hosts" — a horizontal, snap-scrolling row of testimonial
// cards (ONLY the cards scroll, not the page). The edges fade out via a mask
// gradient, and the dots below track / drive which card is in view.

import { useRef, useState } from "react";

type Review = { title: string; name: string; body: string };

const REVIEWS: Review[] = [
  {
    title: "Making memories last forever",
    name: "Rahul",
    body: "Sed posuere consectetur est at lobortis. Curabitur blandit tempus porttitor. Maecenas sed diam eget risus varius blandit sit amet non magna.",
  },
  {
    title: "Unforgettable moments captured",
    name: "James",
    body: "Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Integer posuere erat a ante venenatis dapibus posuere velit aliquet.",
  },
  {
    title: "Capturing memories with style",
    name: "Sam",
    body: "Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus.",
  },
  {
    title: "The easiest gallery ever",
    name: "Aisha",
    body: "Donec ullamcorper nulla non metus auctor fringilla. Nullam quis risus eget urna mollis ornare vel eu leo. Cras mattis consectetur purus sit amet.",
  },
  {
    title: "Every guest became a photographer",
    name: "Marco",
    body: "Vestibulum id ligula porta felis euismod semper. Maecenas faucibus mollis interdum. Morbi leo risus, porta ac consectetur ac, vestibulum at eros.",
  },
];

export default function Reviews() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Map the dots to scroll PROGRESS rather than per-card position. When the
  // cards are smaller than the viewport (e.g. desktop), several share the last
  // bit of scroll, so per-card targeting would saturate and the trailing dots
  // would be unreachable. Progress-mapping keeps every dot reachable and the
  // active dot in sync regardless of how many cards fit on screen.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const ratio = max > 0 ? el.scrollLeft / max : 0;
    setActive(Math.round(ratio * (REVIEWS.length - 1)));
  };

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // Direct assignment — reliable in every tab state (rAF/smooth scrollTo get
    // paused for backgrounded tabs). setActive keeps the dots in sync instantly.
    el.scrollLeft = (i / (REVIEWS.length - 1)) * max;
    setActive(i);
  };

  // Fade the left/right edges so cards dissolve as they scroll off-screen.
  const fadeMask =
    "linear-gradient(to right, transparent 0, black 7%, black 93%, transparent 100%)";

  return (
    <section id="reviews" className="px-[15px] md:px-10 lg:px-16 py-12 md:py-28">
      <h2 className="text-center font-bebas text-[34px] md:text-[56px] font-[800] uppercase tracking-[-0.02em] leading-[0.95]">
        Loved
        <br />
        by event hosts
      </h2>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="mt-12 flex gap-5 overflow-x-auto pb-2 md:mt-16 md:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitMaskImage: fadeMask, maskImage: fadeMask }}
      >
        {REVIEWS.map((r, i) => (
          <article
            key={i}
            className="flex w-[68vw] max-w-[280px] shrink-0 flex-col bg-white p-4 sm:w-[50vw] md:w-[280px]"
          >
            {/* Quote panel */}
            <div className="border border-black/15 bg-[#f4f4f4] p-4">
              <p className="text-[13px] md:text-[15px] leading-[1.5] text-[#1a1a1a]">{r.body}</p>
            </div>
            <h3 className="mt-5 text-center font-bebas text-[15px] md:text-[20px] font-[800] uppercase tracking-[-0.01em] text-black">
              {r.title}
            </h3>
            <p className="mt-2 text-center text-[12px] md:text-[14px] text-[#888]">{r.name}</p>
          </article>
        ))}
      </div>

      {/* Dots */}
      <div className="mt-8 flex items-center justify-center gap-2">
        {REVIEWS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to review ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${i === active ? "w-7 bg-white" : "w-2 bg-white/30 hover:bg-white/50"
              }`}
          />
        ))}
      </div>
    </section>
  );
}
