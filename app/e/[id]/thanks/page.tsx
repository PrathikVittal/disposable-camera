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
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-zinc-50">
      <div className="max-w-sm space-y-6">
        <div className="text-6xl">📷</div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            You&apos;re a star!
          </h1>
          {event && (
            <p className="text-base font-medium text-zinc-300">{event.name}</p>
          )}
        </div>

        <p className="text-sm leading-relaxed text-zinc-400">
          Thanks for being part of the moment and sharing your perspective
          through the lens. Every photo you took is now part of the event
          memory — the host will treasure them.
        </p>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
          <p className="text-sm text-zinc-300">
            You may close this window now.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            No account needed, nothing to save — you&apos;re all done.
          </p>
        </div>
      </div>
    </div>
  );
}
