"use client";

// "Why DDC?" — two cropped phone bezels in ONE horizontal row (never stacked,
// just scaled down on mobile). The left shows the TOP of a phone (upCropped:
// notch visible, cut off at the bottom); the right shows the BOTTOM (downCropped:
// cut at the top, rounded base). They're offset vertically for a staggered look.

const ACCENT = "#4F46E5";

// Per-variant config. The source PNGs (phone-bezel-*Cropped.png) had different
// amounts of transparent padding around the SAME bezel artwork, which is why
// the two phones rendered at different sizes despite an identical CSS width —
// equal canvas width ≠ equal bezel width when the padding differs. The
// "-trimmed" PNGs below are cropped to the bezel's exact bounding box (no
// padding), measured pixel-for-pixel: both are 1142px wide, so sizing by
// canvas width now sizes the actual phone equally too.
//
// `ratio` is the trimmed PNG's width/height. `screen` places the white screen
// layer UNDER the transparent frame: `side` insets left+right to tuck under
// the rails, the "cut" edge sits flush (0), and the rounded edge is inset +
// corner-rounded to match the bezel's inner window — measured directly from
// the PNGs' alpha channel, not eyeballed, including the two-axis radius
// ("H% V%") so the curve stays a true circle at any render size.
const WHY_BEZEL = {
  up: {
    src: "/phone-bezel-upCropped-trimmed.png",
    ratio: 1142 / 1660,
    screen: { top: "3.25%", bottom: "0%", side: "5.4%", roundTop: "12.96% 8.92%", roundBottom: "0px" },
    numberAt: "bottom" as const,
  },
  down: {
    src: "/phone-bezel-downCropped-trimmed.png",
    ratio: 1142 / 1642,
    screen: { top: "0%", bottom: "3.11%", side: "5.4%", roundTop: "0px", roundBottom: "13.13% 9.14%" },
    numberAt: "top" as const,
  },
};

function WhyPhone({
  variant,
  n,
  img,
}: {
  variant: "up" | "down";
  n: string;
  img: string;
}) {
  const cfg = WHY_BEZEL[variant];
  return (
    <div className="relative w-full" style={{ aspectRatio: cfg.ratio }}>
      {/* White screen behind the frame — drop a screen image at `img` later */}
      <div
        className="absolute overflow-hidden bg-white"
        style={{
          top: cfg.screen.top,
          bottom: cfg.screen.bottom,
          left: cfg.screen.side,
          right: cfg.screen.side,
          borderTopLeftRadius: cfg.screen.roundTop,
          borderTopRightRadius: cfg.screen.roundTop,
          borderBottomLeftRadius: cfg.screen.roundBottom,
          borderBottomRightRadius: cfg.screen.roundBottom,
        }}
      >
        {/* Stays hidden (clean white screen) until a real image loads — no
            broken-image icon while the screen image is still a placeholder. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ display: "none" }}
          onLoad={(e) => {
            e.currentTarget.style.display = "block";
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {/* Faint number watermark, near the cut edge */}
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-bebas text-[38px] font-[800] leading-none md:text-[88px]"
          style={{
            color: ACCENT,
            opacity: 0.16,
            top: cfg.numberAt === "top" ? "7%" : undefined,
            bottom: cfg.numberAt === "bottom" ? "7%" : undefined,
          }}
        >
          {n}
        </span>
      </div>
      {/* Transparent cropped bezel on top */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cfg.src}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}

export default function WhyDDC() {
  return (
    <section id="why" className="px-[15px] md:px-10 lg:px-16 py-12 md:py-28">
      <h2 className="text-center font-bebas text-[34px] md:text-[56px] font-[800] uppercase tracking-[-0.02em] leading-[0.95]">
        Why DDC?
      </h2>
      <p className="mx-auto mt-5 max-w-[640px] text-center text-[13px] md:text-[16px] leading-[1.6] text-[#9a9a9a]">
        Guests join instantly by scanning your event&apos;s QR code. No downloads,
        sign-ups, or complicated setup&mdash;just open the camera and start
        capturing memories.
      </p>

      {/* Two cropped phones in one row (same on mobile, just smaller) */}
      <div className="mx-auto mt-12 flex max-w-[720px] items-start justify-center gap-5 md:mt-16 md:gap-12">
        {/* Left — No Sign In (top of phone), label below */}
        <div className="w-1/2 max-w-[300px]">
          <WhyPhone variant="up" n="01" img="/why/no-signin.jpg" />
          <p className="mt-4 text-center font-bebas text-[14px] md:text-[24px] font-[800] uppercase tracking-[0.04em] text-white">
            No Sign In
          </p>
        </div>
        {/* Right — No App Required (bottom of phone), label above, offset down */}
        <div className="mt-0 w-1/2 max-w-[300px] md:mt-0">
          <p className="mb-4 text-center font-bebas text-[14px] md:text-[24px] font-[800] uppercase tracking-[0.04em] text-white">
            No App Required
          </p>
          <WhyPhone variant="down" n="02" img="/why/no-app.jpg" />
        </div>
      </div>
    </section>
  );
}
