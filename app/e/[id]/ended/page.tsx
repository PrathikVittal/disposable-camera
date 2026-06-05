"use client";

import { use, useEffect, useState } from "react";
import type { Event } from "@/lib/types";

export default function EventEndedPage({
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
        <span className="text-[14px] font-[800] tracking-[0.18em]">
          DD<span className="text-[#FF3C00]">C</span>
        </span>

        <h1 className="text-[32px] font-[800] tracking-[-0.03em] leading-[1.05]">
          That&apos;s a wrap.
        </h1>

        {event && (
          <p className="text-[12px] font-[700] text-black">{event.name}</p>
        )}

        <p className="text-[10px] leading-[1.7] text-[#555]">
          The event has ended — thank you for being part of it. Every shot you
          took is safe in the gallery, ready to be relived. We hope you made
          some wonderful memories.
        </p>

        <div className="rounded-[6px] border border-black bg-[#F5F5F5] px-4 py-3">
          <p className="text-[10px] font-[700] text-black">
            The camera&apos;s closed for now.
          </p>
          <p className="mt-1 text-[9px] text-[#888]">
            You can close this window — your photos are already saved.
          </p>
        </div>
      </div>
    </div>
  );
}
