type Stat = {
  value: string | number;
  label: string;
};

export default function StatGrid({
  stats,
  tone = "light",
}: {
  stats: Stat[];
  tone?: "light" | "dark";
}) {
  const borderClass = tone === "dark" ? "border-white/20" : "border-black";
  const valueClass = tone === "dark" ? "text-white" : "text-black";
  return (
    <div className={`flex border-t border-b ${borderClass}`}>
      {stats.map((s, i) => (
        <div
          key={i}
          className={`flex-1 px-3 py-[10px] ${i < stats.length - 1 ? `border-r ${borderClass}` : ""}`}
        >
          <div className={`text-[22px] font-[800] leading-none ${valueClass}`}>
            {s.value}
          </div>
          <div className="text-[7px] font-bold tracking-[0.12em] uppercase text-[#888] mt-[3px]">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
