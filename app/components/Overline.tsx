export default function Overline({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-[8px] font-bold tracking-[0.18em] uppercase text-[#888] mb-1 ${className}`}
    >
      {children}
    </p>
  );
}
