"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import type { Event, Photo } from "@/lib/types";
import Overline from "@/app/components/Overline";
import StatGrid from "@/app/components/StatGrid";

type EventWithPhotos = { event: Event; photos: Photo[] };
type TabKey = "all" | "pending" | "approved";

export default function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<EventWithPhotos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [zipping, setZipping] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowIdx, setSlideshowIdx] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Event not found"); }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load gallery.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const approvedPhotos = useMemo(() => {
    if (!data) return [];
    if (!data.event.moderationEnabled) return data.photos;
    return data.photos.filter((p) => p.status === "approved");
  }, [data]);

  const pendingPhotos = useMemo(
    () => data?.photos.filter((p) => p.status === "pending") ?? [],
    [data],
  );

  const rejectedPhotos = useMemo(
    () => data?.photos.filter((p) => p.status === "rejected") ?? [],
    [data],
  );

  const displayPhotos = useMemo(() => {
    if (tab === "pending") return pendingPhotos;
    if (tab === "approved") return approvedPhotos;
    return data?.photos ?? [];
  }, [tab, pendingPhotos, approvedPhotos, data]);

  const uniqueGuests = useMemo(
    () => new Set(data?.photos.map((p) => p.guestSessionId)).size,
    [data],
  );

  // Slideshow: keyboard navigation + auto-advance
  useEffect(() => {
    if (!slideshowOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSlideshowIdx((prev) => (prev + 1) % displayPhotos.length);
      if (e.key === "ArrowLeft") setSlideshowIdx((prev) => (prev - 1 + displayPhotos.length) % displayPhotos.length);
      if (e.key === "Escape") setSlideshowOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slideshowOpen, displayPhotos.length]);

  useEffect(() => {
    if (!slideshowOpen || displayPhotos.length <= 1) return;
    const timer = setTimeout(
      () => setSlideshowIdx((prev) => (prev + 1) % displayPhotos.length),
      4000,
    );
    return () => clearTimeout(timer);
  }, [slideshowOpen, slideshowIdx, displayPhotos.length]);

  const openSlideshow = (idx: number) => {
    setSlideshowIdx(idx);
    setSlideshowOpen(true);
  };

  const handleDownloadZip = async () => {
    if (!data || displayPhotos.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        displayPhotos.map(async (photo, i) => {
          const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(photo.originalUrl ?? photo.storageUrl)}`);
          const blob = await res.blob();
          const ext = blob.type.split("/")[1] ?? "jpg";
          zip.file(`photo-${String(i + 1).padStart(3, "0")}.${ext}`, blob);
        }),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.event.name.replace(/\s+/g, "-").toLowerCase()}-gallery.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  const handleShare = async () => {
    if (!data) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try { await navigator.share({ title: `${data.event.name} Gallery`, url }); } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url); alert("Gallery link copied."); } catch { alert("Unable to copy."); }
    }
  };

  if (loading) return <div className="min-h-screen bg-white px-[15px] py-10"><p className="text-[10px] text-[#888]">Loading gallery…</p></div>;
  if (error || !data) {
    return (
      <div className="min-h-screen bg-white px-[15px] py-10 text-black">
        <p className="text-[10px] text-red-500">{error ?? "Gallery not found."}</p>
      </div>
    );
  }

  const { event } = data;

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Nav */}
      <nav className="flex items-center justify-between px-[15px] py-2 border-b border-black">
        <span className="text-[14px] font-[800] tracking-[0.18em]">
          DDC
        </span>
        <span className="text-[9px] font-[700] text-[#888] tracking-[0.06em] uppercase">Host View</span>
      </nav>

      {/* Gallery header */}
      <section className="px-[15px] py-[13px] border-b border-black">
        <Overline>
          {event.name} · Gallery
        </Overline>
        <h1 className="text-[22px] font-[800] tracking-[-0.02em]">
          {approvedPhotos.length} photos
        </h1>
        <p className="text-[9px] text-[#888] mt-0.5">
          From {uniqueGuests} guest{uniqueGuests === 1 ? "" : "s"} · Live
        </p>
      </section>

      {/* Stat grid */}
      <StatGrid
        stats={[
          { value: approvedPhotos.length, label: "Approved" },
          { value: pendingPhotos.length, label: "Pending" },
          { value: rejectedPhotos.length, label: "Rejected" },
        ]}
      />

      {/* Tab row */}
      {event.moderationEnabled && (
        <div className="flex border-b border-black">
          {(["all", "pending", "approved"] as TabKey[]).map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-[8px] text-[9px] font-[700] uppercase tracking-[0.08em] ${
                tab === t ? "bg-black text-white" : "bg-white text-[#888]"
              } ${i > 0 ? "border-l border-black" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Photo grid */}
      <section className="px-[15px] py-3">
        {displayPhotos.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[10px] text-[#888]">
              {tab === "pending" ? "No pending photos." : tab === "approved" ? "No approved photos yet." : "No photos yet. Share the QR code to get started."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[3px]">
            {displayPhotos.map((photo, idx) => (
              <div
                key={photo.id}
                className="aspect-square rounded-[3px] overflow-hidden cursor-pointer"
                onClick={() => openSlideshow(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbnailUrl ?? photo.storageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="border-b border-black" />

      {/* Actions */}
      <section className="px-[15px] py-3 space-y-2">
        <button
          type="button"
          onClick={() => openSlideshow(0)}
          disabled={displayPhotos.length === 0}
          className="w-full rounded-[6px] bg-black text-white py-[10px] text-[10px] font-[800] tracking-[0.08em] uppercase disabled:opacity-50"
        >
          ▶ Play slideshow
        </button>
        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={zipping || displayPhotos.length === 0}
          className="w-full rounded-[6px] bg-black text-white py-[10px] text-[10px] font-[800] tracking-[0.08em] uppercase disabled:opacity-50"
        >
          {zipping ? "Preparing ZIP…" : `Download all photos`}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 rounded-[6px] border-[1.5px] border-black py-[9px] text-[10px] font-[700] tracking-[0.08em] uppercase"
          >
            Share gallery
          </button>
          <Link
            href={`/dashboard/events/${id}`}
            className="flex-1 block text-center rounded-[6px] border-[1.5px] border-black py-[9px] text-[10px] font-[700] tracking-[0.08em] uppercase"
          >
            Edit event
          </Link>
        </div>
      </section>

      {/* Slideshow overlay */}
      {slideshowOpen && displayPhotos.length > 0 && (() => {
        const idx = Math.min(slideshowIdx, displayPhotos.length - 1);
        const photo = displayPhotos[idx];
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-black">
            <div className="flex items-center justify-between px-[15px] py-3">
              <span className="text-[9px] text-[#888]">
                {idx + 1} / {displayPhotos.length}
              </span>
              <button
                type="button"
                onClick={() => setSlideshowOpen(false)}
                className="rounded-[6px] border border-white/30 px-3 py-1 text-[9px] text-white"
              >
                Close
              </button>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={photo.id}
                src={photo.storageUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
              {displayPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSlideshowIdx((prev) => (prev - 1 + displayPhotos.length) % displayPhotos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-[6px] bg-white/10 px-3 py-2 text-white text-sm"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideshowIdx((prev) => (prev + 1) % displayPhotos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] bg-white/10 px-3 py-2 text-white text-sm"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
