import Link from "next/link";

const ACCENT = "#4F46E5";

const LINKS = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
  { label: "Cookie policy", href: "/cookies" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden px-[15px] md:px-10 lg:px-16 pt-16">
      <nav className="flex flex-wrap gap-x-8 gap-y-2 text-[14px] text-[#888]">
        {LINKS.map((l) => (
          <Link key={l.label} href={l.href} className="hover:text-white">
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Oversized wordmark, clipped at the bottom by the section's overflow-hidden */}
      <div
        aria-hidden
        className="mt-6 select-none font-bebas font-[800] uppercase leading-[0.78] tracking-[-0.04em] text-[22vw] md:text-[400px]"
        style={{ color: ACCENT, marginBottom: "-0.16em" }}
      >
        DDC
      </div>
    </footer>
  );
}
