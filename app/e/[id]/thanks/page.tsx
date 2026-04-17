"use client";

import { use, useEffect, useState } from "react";
import type { Event } from "@/lib/types";

export default function ThanksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((json) => setEvent(json.event ?? null))
      .catch(() => null);
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-[15px] text-center text-black">
      <div className="max-w-sm space-y-5">
        <h1 className="text-[32px] font-[800] tracking-[-0.03em]">
          You&apos;re a star!
        </h1>
        {event && (
          <p className="text-[12px] font-[700] text-black">{event.name}</p>
        )}

        <p className="text-[10px] leading-[1.7] text-[#555]">
          Thanks for being part of the moment and sharing your perspective
          through the lens. Every photo you took is now part of the event
          memory — the host will treasure them.
        </p>

        <div className="rounded-[6px] border border-black bg-[#F5F5F5] px-4 py-3">
          <p className="text-[10px] font-[700] text-black">
            You may close this window now.
          </p>
          <p className="mt-1 text-[9px] text-[#888]">
            No account needed, nothing to save — you&apos;re all done.
          </p>
        </div>
      </div>
    </div>
  );
}
