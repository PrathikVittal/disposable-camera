import Link from "next/link";
import Overline from "@/app/components/Overline";
import StatGrid from "@/app/components/StatGrid";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Nav */}
      <nav className="flex items-center justify-between px-[15px] py-2 border-b border-black">
        <span className="text-[14px] font-[800] tracking-[0.18em]">
          DD<span className="text-[#FF3C00]">C</span>
        </span>
        <Link
          href="/dashboard"
          className="bg-black text-white text-[10px] font-[800] tracking-[0.08em] uppercase rounded-[4px] px-3 py-[6px]"
        >
          Dashboard &rarr;
        </Link>
      </nav>

      {/* Hero */}
      <section className="bg-black text-white px-[15px] py-6">
        <Overline className="text-[#888] mb-3">Digital Disposable Camera</Overline>
        <h1 className="text-[32px] font-[800] tracking-[-0.03em] leading-[1.05]">
          Every guest.<br />
          <span className="text-[#FF3C00] italic">One</span><br />
          gallery.
        </h1>
        <p className="text-[10px] text-[#888] leading-[1.6] mt-3 max-w-[300px]">
          Create an event, share a QR code, watch photos land in real time. No app. No login. No friction.
        </p>
        <div className="flex gap-2 mt-5">
          <Link
            href="/dashboard"
            className="flex-[2] bg-white text-black text-center text-[10px] font-[800] tracking-[0.08em] uppercase rounded-[6px] py-[11px]"
          >
            Create event &rarr;
          </Link>
          <a
            href="#how"
            className="flex-1 border-[1.5px] border-white text-white text-center text-[10px] font-[700] tracking-[0.08em] uppercase rounded-[6px] py-[10px]"
          >
            How?
          </a>
        </div>
      </section>

      {/* Stat Grid */}
      <StatGrid
        stats={[
          { value: "1", label: "Create" },
          { value: "2", label: "Share QR" },
          { value: "3", label: "Live Gallery", accent: true },
        ]}
      />

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
          className="block w-full bg-[#FF3C00] text-white text-center text-[10px] font-[800] tracking-[0.08em] uppercase rounded-[6px] py-[11px]"
        >
          Get started &mdash; it&apos;s free
        </Link>
      </section>
    </div>
  );
}
