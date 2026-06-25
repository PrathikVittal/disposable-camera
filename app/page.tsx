import Link from "next/link";
import Overline from "@/app/components/Overline";
import StatGrid from "@/app/components/StatGrid";

// Circular image carousel: two concentric rings of white-framed snapshots
// orbiting the hero copy, with a radial vignette clearing the center —
// stand-ins for real guest photos until we have a curated set to drop in.
// Each ring spins continuously via the `orbit` keyframes (globals.css);
// every card counter-spins by the same amount so the photo stays upright
// while its position still travels around the circle. The outer ring spins
// slower than the inner ring.
const OUTER_RING_DURATION = "90s";
const INNER_RING_DURATION = "60s";

// Every card is one of two exact shapes (from Figma dev-mode measurements,
// taken at the lg tier — base/md scale those down 0.6x/0.8x, keeping the
// same aspect ratio so the polaroid proportions never distort):
//   rect:   90 x 120 border (3:4)    square: 120 x 120 border (1:1)
const RECT_SIZE = "w-[54px] h-[72px] md:w-[72px] md:h-[96px] lg:w-[90px] lg:h-[120px]";
const SQUARE_SIZE = "w-[72px] h-[72px] md:w-[96px] md:h-[96px] lg:w-[120px] lg:h-[120px]";

const OUTER_RING_CARDS = [
  { top: "2%", left: "2%", rotate: -10, shape: "rect", name: "outer1" },
  { top: "-2%", left: "30%", rotate: 6, shape: "square", name: "outer2" },
  { top: "0%", left: "58%", rotate: -8, shape: "rect", name: "outer3" },
  { top: "4%", left: "84%", rotate: 10, shape: "square", name: "outer4" },
  { top: "24%", left: "90%", rotate: -6, shape: "rect", name: "outer5", opacity: 0.85 },
  { top: "48%", left: "94%", rotate: 9, shape: "square", name: "outer6", opacity: 0.7 },
  { top: "72%", left: "86%", rotate: -10, shape: "rect", name: "outer7" },
  { top: "88%", left: "60%", rotate: 7, shape: "square", name: "outer8" },
  { top: "90%", left: "30%", rotate: -6, shape: "rect", name: "outer9" },
  { top: "84%", left: "2%", rotate: 9, shape: "square", name: "outer10" },
  { top: "56%", left: "-4%", rotate: -8, shape: "rect", name: "outer11", opacity: 0.7 },
  { top: "26%", left: "-6%", rotate: 11, shape: "square", name: "outer12", opacity: 0.85 },
];

const INNER_RING_CARDS = [
  { top: "24%", left: "24%", rotate: 8, shape: "square", name: "inner1" },
  { top: "21%", left: "39%", rotate: -7, shape: "rect", name: "inner2" },
  { top: "23%", left: "54%", rotate: 9, shape: "square", name: "inner3" },
  { top: "25%", left: "69%", rotate: -9, shape: "rect", name: "inner4" },
  { top: "36%", left: "72%", rotate: 6, shape: "square", name: "inner5", opacity: 0.9 },
  { top: "49%", left: "74%", rotate: -8, shape: "rect", name: "inner6", opacity: 0.8 },
  { top: "62%", left: "70%", rotate: 9, shape: "square", name: "inner7" },
  { top: "71%", left: "56%", rotate: -6, shape: "rect", name: "inner8" },
  { top: "72%", left: "39%", rotate: 7, shape: "square", name: "inner9" },
  { top: "69%", left: "24%", rotate: -9, shape: "rect", name: "inner10" },
  { top: "53%", left: "20%", rotate: 8, shape: "square", name: "inner11", opacity: 0.8 },
  { top: "37%", left: "19%", rotate: -10, shape: "rect", name: "inner12", opacity: 0.9 },
];

function PhotoRing({
  cards,
  duration,
}: {
  cards: typeof OUTER_RING_CARDS;
  duration: string;
}) {
  return (
    // Square frame sized off the smaller of the section's width/height (via
    // container query units), so the ring stays a true circle even when the
    // hero is much wider than it is tall — plain %-of-box positioning below
    // would otherwise stretch into a lopsided oval on wide viewports.
    <div
      className="absolute"
      style={{
        top: "50%",
        left: "50%",
        width: "170cqmin",
        height: "170cqmin",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ animation: `orbit ${duration} linear infinite` }}
      >
        {cards.map((c, i) => (
          <div
            key={i}
            className="absolute"
            style={{ top: c.top, left: c.left }}
          >
            {/* Counter-spin: cancels the ring's rotation so the photo stays upright. */}
            <div style={{ animation: `orbit ${duration} linear infinite reverse` }}>
              <div
                className={`bg-white pt-[3px] px-[3px] pb-[6px] md:pt-[4px] md:px-[4px] md:pb-[8px] lg:pt-[4.8px] lg:px-[4.8px] lg:pb-[9.6px] shadow-[0_8px_20px_rgba(0,0,0,0.15)] ${c.shape === "square" ? SQUARE_SIZE : RECT_SIZE}`}
                style={{
                  transform: `rotate(${c.rotate}deg)`,
                  opacity: c.opacity ?? 1,
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
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Nav — floats over the hero so the glass effect has photos to show through */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-[15px] md:px-10 lg:px-16 py-2 md:py-4 bg-white/40 backdrop-blur-xl">
        <span className="text-[14px] md:text-[18px] font-[800] tracking-[0.18em]">
          DDC
        </span>
        <div className="flex items-center gap-6">
          <a
            href="#how"
            className="hidden md:inline text-[11px] font-[700] tracking-[0.06em] uppercase text-[#555] hover:text-black"
          >
            How it works
          </a>
          <Link
            href="/dashboard"
            className="bg-black text-white text-[10px] md:text-[11px] font-[800] tracking-[0.08em] uppercase rounded-[4px] md:rounded-full px-3 md:px-5 py-[6px] md:py-[9px]"
          >
            Dashboard &rarr;
          </Link>
        </div>
      </nav>

      {/* Hero — circular image carousel */}
      <section
        className="relative h-[480px] sm:h-[560px] md:h-[680px] lg:h-[760px] overflow-hidden bg-white"
        style={{ containerType: "size", width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      >
        {/* Two concentric rings of photo cards, each spinning continuously */}
        <div className="absolute inset-0 pointer-events-none">
          <PhotoRing cards={OUTER_RING_CARDS} duration={OUTER_RING_DURATION} />
          <PhotoRing cards={INNER_RING_CARDS} duration={INNER_RING_DURATION} />
          {/* Radial vignette: clears the center, reveals photos at the edges */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 30% 30% at 50% 44%, #fff 0%, #fff 62%, rgba(255,255,255,0.55) 82%, rgba(255,255,255,0) 100%)",
            }}
          />
          {/* Fade the bottom edge into the next section */}
          <div className="absolute inset-x-0 bottom-0 h-20 md:h-28 bg-gradient-to-b from-transparent to-white" />
        </div>

        {/* Centered copy */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-[15px] text-center">
          <p className="text-[12px] md:text-[15px] lg:text-[17px] font-[800] tracking-[0.2em] uppercase text-black">
            Gather
          </p>
          <h1 className="text-[30px] sm:text-[36px] md:text-[48px] lg:text-[56px] font-[800] tracking-[-0.03em] leading-[1.05] text-black">
            Capture<br />
            every perspective
          </h1>
          <p className="text-[10px] md:text-[13px] lg:text-[14px] text-[#555] leading-[1.6] mt-3 max-w-[280px] md:max-w-[360px]">
            Turn every guest into a photographer.<br />
            No app. No login. Just scan, snap, and share.
          </p>
          <div className="flex gap-3 mt-5">
            <Link
              href="/dashboard"
              className="bg-black text-white text-[10px] md:text-[13px] font-[800] tracking-[0.08em] uppercase rounded-full px-6 md:px-8 py-[11px] md:py-[13px]"
            >
              Create event
            </Link>
            <a
              href="#how"
              className="border-[1.5px] border-black text-black text-[10px] md:text-[13px] font-[700] tracking-[0.08em] uppercase rounded-full px-6 md:px-8 py-[10px] md:py-[12px]"
            >
              How?
            </a>
          </div>
        </div>
      </section>

      {/* Stat Grid */}
      <div id="how" className="mt-[20px] md:mt-[36px] lg:mt-[44px]">
        <StatGrid
          stats={[
            { value: "1", label: "Create" },
            { value: "2", label: "Share QR" },
            { value: "3", label: "Live Gallery" },
          ]}
        />
      </div>

      {/* For Hosts */}
      <section className="px-[15px] py-[14px] border-b border-black">
        <Overline>For Hosts</Overline>
        <p className="text-[10px] text-[#555] leading-[1.6] mt-1">
          Create events, set photo limits, enable moderation, and download your full gallery.
        </p>
      </section>

      {/* For Guests */}
      <section className="px-[15px] py-[14px] border-b border-black">
        <Overline>For Guests</Overline>
        <p className="text-[10px] text-[#555] leading-[1.6] mt-1">
          Scan. Shoot. Done. No app download, no account, no friction. Just open the camera and capture the moment.
        </p>
      </section>

      {/* Final CTA */}
      <section className="px-[15px] py-[14px]">
        <Link
          href="/dashboard"
          className="block w-full bg-black text-white text-center text-[10px] font-[800] tracking-[0.08em] uppercase rounded-[6px] py-[11px]"
        >
          Get started &mdash; it&apos;s free
        </Link>
      </section>
    </div>
  );
}
