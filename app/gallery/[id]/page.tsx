"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Event, Photo } from "@/lib/types";

type EventWithPhotos = {
  event: Event;
  photos: Photo[];
};

export default function PublicGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<EventWithPhotos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowIdx, setSlideshowIdx] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Event not found");
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load gallery.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Only show approved photos (or all if moderation is off)
  const visiblePhotos = useMemo(() => {
    if (!data) return [];
    if (data.event.moderationEnabled) {
      return data.photos.filter((p) => p.status === "approved");
    }
    return data.photos;
  }, [data]);

  // Keyboard navigation for slideshow
  useEffect(() => {
    if (!slideshowOpen || visiblePhotos.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight")
        setSlideshowIdx((prev) => (prev + 1) % visiblePhotos.length);
      if (e.key === "ArrowLeft")
        setSlideshowIdx((prev) => (prev - 1 + visiblePhotos.length) % visiblePhotos.length);
      if (e.key === "Escape") setSlideshowOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slideshowOpen, visiblePhotos.length]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!slideshowOpen || visiblePhotos.length <= 1) return;
    const timer = setTimeout(
      () => setSlideshowIdx((prev) => (prev + 1) % visiblePhotos.length),
      4000,
    );
    return () => clearTimeout(timer);
  }, [slideshowOpen, slideshowIdx, visiblePhotos.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50">
        <p className="text-sm text-zinc-400">Loading gallery…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50">
        <p className="text-sm text-red-400">{error ?? "Gallery not found."}</p>
      </div>
    );
  }

  const { event } = data;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        {/* Header */}
        <header className="mb-8 space-y-4">
          {event.coverImageUrl && (
            <div className="overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.coverImageUrl}
                alt={event.name}
                className="h-48 w-full object-cover sm:h-64"
              />
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {event.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {event.date}
                {event.startTime && event.endTime
                  ? ` • ${event.startTime}–${event.endTime}`
                  : ""}
              </p>
              {event.description && (
                <p className="mt-2 text-sm text-zinc-500">{event.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">
                {visiblePhotos.length} photo{visiblePhotos.length === 1 ? "" : "s"}
              </span>
              {visiblePhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setSlideshowIdx(0); setSlideshowOpen(true); }}
                  className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                >
                  Slideshow
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Gallery grid */}
        {visiblePhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="rounded-full border border-zinc-800 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-zinc-600">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No photos yet.</p>
            <Link
              href={`/e/${id}`}
              className="rounded-full bg-zinc-50 px-5 py-2 text-sm font-medium text-black hover:bg-zinc-200"
            >
              Take photos
            </Link>
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {visiblePhotos.map((photo, i) => (
              <div
                key={photo.id}
                className="mb-3 cursor-pointer overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                onClick={() => { setSlideshowIdx(i); setSlideshowOpen(true); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.storageUrl}
                  alt=""
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}

        <footer className="mt-12 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-600">
          <p>
            Powered by{" "}
            <Link href="/" className="underline-offset-4 hover:underline">
              Digital Disposable Events
            </Link>
          </p>
        </footer>
      </main>

      {/* Slideshow overlay */}
      {slideshowOpen && visiblePhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-xs text-zinc-400">
                {slideshowIdx + 1} / {visiblePhotos.length}
              </span>
              <span className="ml-3 text-xs text-zinc-500">{event.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setSlideshowOpen(false)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={visiblePhotos[slideshowIdx].id}
              src={visiblePhotos[slideshowIdx].storageUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {visiblePhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSlideshowIdx(
                      (prev) => (prev - 1 + visiblePhotos.length) % visiblePhotos.length,
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-black/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSlideshowIdx((prev) => (prev + 1) % visiblePhotos.length)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-black/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  ›
                </button>
              </>
            )}
          </div>
          {visiblePhotos.length > 1 && (
            <div className="flex justify-center gap-1.5 py-3">
              {visiblePhotos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlideshowIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === slideshowIdx ? "w-4 bg-zinc-100" : "w-1.5 bg-zinc-600"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
