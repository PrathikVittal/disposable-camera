type Stat = {
  value: string | number;
  label: string;
  accent?: boolean;
};

export default function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="flex border-t border-b border-black">
      {stats.map((s, i) => (
        <div
          key={i}
          className={`flex-1 px-3 py-[10px] ${i < stats.length - 1 ? "border-r border-black" : ""}`}
        >
          <div
            className={`text-[22px] font-[800] leading-none ${s.accent ? "text-[#FF3C00]" : "text-black"}`}
          >
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
