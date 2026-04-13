"use client";

import { useEffect, useRef, useState } from "react";

const ITEM_HEIGHT = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function roundMinute(raw: string): string {
  const num = parseInt(raw, 10);
  if (isNaN(num)) return "00";
  const rounded = Math.round(num / 5) * 5;
  return String(Math.min(rounded, 55)).padStart(2, "0");
}

export default function TimePicker({ value, onChange, placeholder = "--:--" }: Props) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(() => (value ? value.split(":")[0] : "09"));
  const [minute, setMinute] = useState(() =>
    value ? roundMinute(value.split(":")[1] ?? "00") : "00",
  );

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const minuteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync internal state when prop changes
  useEffect(() => {
    if (value) {
      setHour(value.split(":")[0]);
      setMinute(roundMinute(value.split(":")[1] ?? "00"));
    }
  }, [value]);

  // Scroll columns into position each time the popover opens
  useEffect(() => {
    if (!open) return;
    const hIdx = HOURS.indexOf(hour);
    const mIdx = MINUTES.indexOf(minute) === -1 ? 0 : MINUTES.indexOf(minute);
    requestAnimationFrame(() => {
      hourRef.current?.scrollTo({ top: hIdx * ITEM_HEIGHT });
      minuteRef.current?.scrollTo({ top: mIdx * ITEM_HEIGHT });
    });
  }, [open, hour, minute]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    clearTimeout(hourTimer.current);
    hourTimer.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(idx, HOURS.length - 1));
      setHour(HOURS[clamped]);
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
    }, 120);
  };

  const handleMinuteScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    clearTimeout(minuteTimer.current);
    minuteTimer.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(idx, MINUTES.length - 1));
      setMinute(MINUTES[clamped]);
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
    }, 120);
  };

  const scrollToHour = (h: string) => {
    setHour(h);
    hourRef.current?.scrollTo({ top: HOURS.indexOf(h) * ITEM_HEIGHT, behavior: "smooth" });
  };

  const scrollToMinute = (m: string) => {
    setMinute(m);
    minuteRef.current?.scrollTo({
      top: MINUTES.indexOf(m) * ITEM_HEIGHT,
      behavior: "smooth",
    });
  };

  const handleDone = () => {
    onChange(`${hour}:${minute}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-50 outline-none focus:border-zinc-400"
      >
        {value || <span className="text-zinc-500">{placeholder}</span>}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          {/* Scroll columns */}
          <div className="relative flex items-center px-3 pt-2 pb-1">
            {/* Center highlight bar */}
            <div
              className="pointer-events-none absolute inset-x-3 rounded-lg bg-zinc-700/50"
              style={{
                top: `calc(${ITEM_HEIGHT}px + 8px)`,
                height: ITEM_HEIGHT,
              }}
            />

            {/* Hours */}
            <div
              ref={hourRef}
              onScroll={handleHourScroll}
              className="flex-1 overflow-y-auto [scroll-snap-type:y_mandatory] [&::-webkit-scrollbar]:hidden"
              style={{ height: ITEM_HEIGHT * 3 }}
            >
              <div style={{ height: ITEM_HEIGHT }} />
              {HOURS.map((h) => (
                <div
                  key={h}
                  onClick={() => scrollToHour(h)}
                  className={`flex cursor-pointer select-none items-center justify-center [scroll-snap-align:center] text-sm font-medium transition-colors ${
                    h === hour ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  style={{ height: ITEM_HEIGHT }}
                >
                  {h}
                </div>
              ))}
              <div style={{ height: ITEM_HEIGHT }} />
            </div>

            <span className="relative z-10 px-1 text-sm font-bold text-zinc-300">:</span>

            {/* Minutes */}
            <div
              ref={minuteRef}
              onScroll={handleMinuteScroll}
              className="flex-1 overflow-y-auto [scroll-snap-type:y_mandatory] [&::-webkit-scrollbar]:hidden"
              style={{ height: ITEM_HEIGHT * 3 }}
            >
              <div style={{ height: ITEM_HEIGHT }} />
              {MINUTES.map((m) => (
                <div
                  key={m}
                  onClick={() => scrollToMinute(m)}
                  className={`flex cursor-pointer select-none items-center justify-center [scroll-snap-align:center] text-sm font-medium transition-colors ${
                    m === minute ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  style={{ height: ITEM_HEIGHT }}
                >
                  {m}
                </div>
              ))}
              <div style={{ height: ITEM_HEIGHT }} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-zinc-800 p-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 rounded-full border border-zinc-700 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="flex-1 rounded-full bg-zinc-50 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
