"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import JSZip from "jszip";
import type { Event, Photo } from "@/lib/types";
import QRCode, { type QRCodeHandle } from "@/app/components/QRCode";
import TimePicker from "@/app/components/TimePicker";

type EventWithPhotos = {
  event: Event;
  photos: Photo[];
};

type EditForm = {
  name: string;
  date: string;
  description: string;
  startTime: string;
  endTime: string;
  photoLimitPerGuest: number;
  moderationEnabled: boolean;
};

function buildGuestUrl(eventId: string) {
  if (typeof window === "undefined") return `/e/${eventId}`;
  const url = new URL(window.location.href);
  url.pathname = `/e/${eventId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildGalleryUrl(eventId: string) {
  if (typeof window === "undefined") return `/gallery/${eventId}`;
  const url = new URL(window.location.href);
  url.pathname = `/gallery/${eventId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<EventWithPhotos | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending">("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [zipping, setZipping] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowIdx, setSlideshowIdx] = useState(0);

  // Edit panel state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Bulk moderation state
  const [bulkPending, setBulkPending] = useState(false);

  const fetchEvent = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to load event");
      }
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load event.");
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
    const interval = setInterval(() => fetchEvent(), 5000);
    return () => clearInterval(interval);
  }, [fetchEvent]);

  const qrRef = useRef<QRCodeHandle>(null);

  const guestLink = useMemo(() => buildGuestUrl(id), [id]);
  const galleryLink = useMemo(() => buildGalleryUrl(id), [id]);

  const handleDownloadQR = () => {
    const dataUrl = qrRef.current?.toDataURL();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${data?.event.name ?? "event"}-qr.png`;
    a.click();
  };

  const handleDownloadPoster = () => {
    const srcCanvas = qrRef.current?.getCanvas();
    if (!srcCanvas || !data) return;

    const QR_SIZE = 280;
    const PADDING = 40;
    const TEXT_AREA = 160;
    const FOOTER = 48;
    const W = QR_SIZE + PADDING * 2;
    const H = TEXT_AREA + QR_SIZE + FOOTER + PADDING * 2;

    const poster = document.createElement("canvas");
    poster.width = W;
    poster.height = H;
    const ctx = poster.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#111111";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const maxWidth = W - PADDING * 2;
    const words = data.event.name.split(" ");
    let line = "";
    let y = PADDING;
    const lineHeight = 36;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, W / 2, y);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, W / 2, y);
    y += lineHeight + 12;

    ctx.font = "18px system-ui, sans-serif";
    ctx.fillStyle = "#555555";
    ctx.fillText(data.event.date, W / 2, y);
    y += 30 + 24;

    const qrX = (W - QR_SIZE) / 2;
    ctx.drawImage(srcCanvas, qrX, y, QR_SIZE, QR_SIZE);
    y += QR_SIZE + 20;

    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText("Scan to take photos — no app needed", W / 2, y);

    const dataUrl = poster.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${data.event.name.replace(/\s+/g, "-").toLowerCase()}-qr-poster.png`;
    a.click();
  };

  const filteredPhotos = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "pending") return data.photos.filter((p) => p.status === "pending");
    if (data.event.moderationEnabled) return data.photos.filter((p) => p.status === "approved");
    return data.photos;
  }, [data, statusFilter]);

  const pendingCount = useMemo(
    () => data?.photos.filter((p) => p.status === "pending").length ?? 0,
    [data],
  );

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Copied to clipboard.");
    } catch {
      alert("Unable to copy. Please copy it manually.");
    }
  };

  const handleApprove = async (photoId: string) => {
    try {
      const res = await fetch(`/api/events/${id}/photos/${photoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) throw new Error("Failed to approve photo");
      const json = await res.json();
      setData((prev) =>
        prev
          ? { ...prev, photos: prev.photos.map((p) => (p.id === json.photo.id ? json.photo : p)) }
          : prev,
      );
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to approve photo.");
    }
  };

  const handleReject = async (photoId: string) => {
    try {
      const res = await fetch(`/api/events/${id}/photos/${photoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reject photo");
      setData((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev,
      );
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to reject photo.");
    }
  };

  // Bulk approve all pending
  const handleApproveAll = async () => {
    const pending = data?.photos.filter((p) => p.status === "pending") ?? [];
    if (pending.length === 0) return;
    setBulkPending(true);
    try {
      await Promise.all(
        pending.map((p) =>
          fetch(`/api/events/${id}/photos/${p.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "approved" }),
          }),
        ),
      );
      await fetchEvent(false);
    } finally {
      setBulkPending(false);
    }
  };

  // Bulk reject (delete) all pending
  const handleRejectAll = async () => {
    const pending = data?.photos.filter((p) => p.status === "pending") ?? [];
    if (pending.length === 0) return;
    setBulkPending(true);
    try {
      await Promise.all(
        pending.map((p) =>
          fetch(`/api/events/${id}/photos/${p.id}`, { method: "DELETE" }),
        ),
      );
      await fetchEvent(false);
    } finally {
      setBulkPending(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!data || filteredPhotos.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      // Fetch each photo from CDN and add to ZIP
      await Promise.all(
        filteredPhotos.map(async (photo, i) => {
          const res = await fetch(photo.storageUrl);
          const blob = await res.blob();
          const ext = blob.type.split("/")[1] ?? "jpg";
          zip.file(`photo-${String(i + 1).padStart(3, "0")}.${ext}`, blob);
        }),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.event.name.replace(/\s+/g, "-").toLowerCase()}-photos.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  // Keyboard navigation for slideshow
  useEffect(() => {
    if (!slideshowOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight")
        setSlideshowIdx((prev) => (prev + 1) % filteredPhotos.length);
      if (e.key === "ArrowLeft")
        setSlideshowIdx((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
      if (e.key === "Escape") setSlideshowOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slideshowOpen, filteredPhotos.length]);

  useEffect(() => {
    if (!slideshowOpen || filteredPhotos.length <= 1) return;
    const timer = setTimeout(
      () => setSlideshowIdx((prev) => (prev + 1) % filteredPhotos.length),
      4000,
    );
    return () => clearTimeout(timer);
  }, [slideshowOpen, slideshowIdx, filteredPhotos.length]);

  // Open edit panel
  const openEdit = () => {
    if (!data) return;
    setEditForm({
      name: data.event.name,
      date: data.event.date,
      description: data.event.description ?? "",
      startTime: data.event.startTime ?? "",
      endTime: data.event.endTime ?? "",
      photoLimitPerGuest: data.event.photoLimitPerGuest,
      moderationEnabled: data.event.moderationEnabled,
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : false;
    setEditForm((prev) =>
      prev
        ? {
            ...prev,
            [name]:
              type === "checkbox"
                ? checked
                : name === "photoLimitPerGuest"
                  ? Number(value)
                  : value,
          }
        : prev,
    );
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !data) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to save changes");
      }
      const json = await res.json();
      setData((prev) => (prev ? { ...prev, event: json.event } : prev));
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:px-8">
        <p className="text-sm text-zinc-400">Loading event…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:px-8">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          ← Back to dashboard
        </Link>
        <p className="mt-4 text-sm text-red-400">
          {error ?? "Event not found."}
        </p>
      </div>
    );
  }

  const { event } = data;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Link
              href="/dashboard"
              className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            >
              ← Back to dashboard
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {event.name}
              </h1>
              <button
                type="button"
                onClick={openEdit}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
              >
                Edit event
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {event.date}
              {event.startTime && event.endTime
                ? ` • ${event.startTime}–${event.endTime}`
                : ""}{" "}
              • {event.photoLimitPerGuest} photos/guest •{" "}
              Moderation {event.moderationEnabled ? "on" : "off"}
            </p>
            {event.description && (
              <p className="mt-2 text-sm text-zinc-500">{event.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="rounded-full border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr),minmax(0,1.2fr)]">
          {/* Left: Share panel */}
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Share with guests
            </h2>

            {event.coverImageUrl && (
              <div className="overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.coverImageUrl} alt="" className="h-24 w-full object-cover" />
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5 text-xs">
                <p className="font-medium text-zinc-200">Guest link</p>
                <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2">
                  <span className="line-clamp-1 flex-1 text-[11px] text-zinc-400">
                    {guestLink}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(guestLink)}
                    className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="font-medium text-zinc-200">Public gallery</p>
                <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2">
                  <span className="line-clamp-1 flex-1 text-[11px] text-zinc-400">
                    {galleryLink}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(galleryLink)}
                    className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    Copy
                  </button>
                </div>
                <Link
                  href={`/gallery/${id}`}
                  target="_blank"
                  className="inline-block text-[11px] text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
                >
                  Open gallery ↗
                </Link>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-200">QR code</p>
                <div className="flex justify-center rounded-xl bg-white p-3">
                  <QRCode ref={qrRef} value={guestLink} size={180} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadQR}
                    className="flex-1 rounded-full border border-zinc-700 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    Download QR
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPoster}
                    className="flex-1 rounded-full border border-zinc-700 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    Download poster
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Gallery panel */}
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Event gallery
                </h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Auto-refreshes every 5s.{" "}
                  {lastRefreshed && (
                    <span>Updated {lastRefreshed.toLocaleTimeString()}.</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fetchEvent(true)}
                  disabled={refreshing}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {refreshing ? "…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSlideshowIdx(0); setSlideshowOpen(true); }}
                  disabled={filteredPhotos.length === 0}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Slideshow
                </button>
              </div>
              <div className="flex gap-1 rounded-full bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 ring-1 ring-zinc-700">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`rounded-full px-2 py-0.5 ${statusFilter === "all" ? "bg-zinc-100 text-black" : "text-zinc-300"}`}
                >
                  All
                </button>
                {event.moderationEnabled && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("pending")}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${statusFilter === "pending" ? "bg-amber-300 text-black" : "text-zinc-300"}`}
                  >
                    Pending
                    {pendingCount > 0 && (
                      <span className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${statusFilter === "pending" ? "bg-black/20" : "bg-amber-400/20 text-amber-300"}`}>
                        {pendingCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {filteredPhotos.length === 0 ? (
              <p className="text-sm text-zinc-400">
                {statusFilter === "pending"
                  ? "No photos waiting for review."
                  : "No photos yet. Ask guests to scan the link and start shooting."}
              </p>
            ) : statusFilter === "pending" ? (
              <>
                {/* Bulk actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApproveAll}
                    disabled={bulkPending}
                    className="flex-1 rounded-full bg-emerald-600 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {bulkPending ? "Processing…" : `Approve all (${pendingCount})`}
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectAll}
                    disabled={bulkPending}
                    className="flex-1 rounded-full bg-red-700/70 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600/70 disabled:opacity-50"
                  >
                    {bulkPending ? "Processing…" : `Reject all (${pendingCount})`}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {filteredPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-amber-400/30 bg-zinc-900"
                    >
                      <div className="relative aspect-[3/4]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.storageUrl} alt="" className="h-full w-full object-cover" />
                        <span className="absolute left-2 top-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                          Pending
                        </span>
                      </div>
                      <div className="px-2 pb-1 pt-1.5 text-[11px] text-zinc-500">
                        {new Date(photo.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="flex gap-1.5 border-t border-zinc-800 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(photo.id)}
                          className="flex-1 rounded-full bg-emerald-500 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(photo.id)}
                          className="flex-1 rounded-full bg-red-600/80 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={zipping}
                  className="w-full rounded-full border border-zinc-700 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {zipping
                    ? "Preparing ZIP…"
                    : `Download all ${filteredPhotos.length} photo${filteredPhotos.length === 1 ? "" : "s"} as ZIP`}
                </button>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filteredPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                    >
                      <div className="relative aspect-[3/4]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.storageUrl} alt="" className="h-full w-full object-cover" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="px-2.5 py-1.5 text-[11px] text-zinc-500">
                        {new Date(photo.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Slideshow overlay */}
      {slideshowOpen && filteredPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-zinc-400">
              {slideshowIdx + 1} / {filteredPhotos.length}
            </span>
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
              key={filteredPhotos[slideshowIdx].id}
              src={filteredPhotos[slideshowIdx].storageUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSlideshowIdx(
                    (prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length,
                  )
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-black/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                ‹
              </button>
            )}
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSlideshowIdx((prev) => (prev + 1) % filteredPhotos.length)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-black/60 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                ›
              </button>
            )}
          </div>
          {filteredPhotos.length > 1 && (
            <div className="flex justify-center gap-1.5 py-3">
              {filteredPhotos.map((_, i) => (
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

      {/* Edit event panel (slide-in from right) */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditOpen(false)}
          />
          {/* Panel */}
          <div className="h-full w-full max-w-sm overflow-y-auto bg-zinc-950 shadow-2xl sm:w-96">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">Edit event</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-zinc-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Event name</label>
                <input
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Date</label>
                <input
                  type="date"
                  name="date"
                  value={editForm.date}
                  onChange={handleEditChange}
                  required
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Starts at</label>
                  <TimePicker
                    value={editForm.startTime}
                    onChange={(v) => setEditForm((p) => p ? { ...p, startTime: v } : p)}
                    placeholder="--:--"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Ends at</label>
                  <TimePicker
                    value={editForm.endTime}
                    onChange={(v) => setEditForm((p) => p ? { ...p, endTime: v } : p)}
                    placeholder="--:--"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Description</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Photo limit per guest</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  name="photoLimitPerGuest"
                  value={editForm.photoLimitPerGuest}
                  onChange={handleEditChange}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  name="moderationEnabled"
                  checked={editForm.moderationEnabled}
                  onChange={handleEditChange}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                />
                Enable photo moderation
              </label>

              {editError && (
                <p className="text-xs text-red-400">{editError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-full border border-zinc-700 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-full bg-zinc-50 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
