"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import JSZip from "jszip";
import type { Event, Photo } from "@/lib/types";
import QRCode, { type QRCodeHandle } from "@/app/components/QRCode";
import TimePicker from "@/app/components/TimePicker";
import Overline from "@/app/components/Overline";
import StatGrid from "@/app/components/StatGrid";
import { getTimezones, browserTimezone } from "@/lib/timezones";

const TIMEZONES = getTimezones();

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
  timezone: string;
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

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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
      const res = await fetch(`/api/events/${id}/photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reject photo");
      setData((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : prev,
      );
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to reject photo.");
    }
  };

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
      await Promise.all(
        filteredPhotos.map(async (photo, i) => {
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
      a.download = `${data.event.name.replace(/\s+/g, "-").toLowerCase()}-photos.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  useEffect(() => {
    if (!slideshowOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSlideshowIdx((prev) => (prev + 1) % filteredPhotos.length);
      if (e.key === "ArrowLeft") setSlideshowIdx((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
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

  const openEdit = () => {
    if (!data) return;
    setEditForm({
      name: data.event.name,
      date: data.event.date,
      description: data.event.description ?? "",
      startTime: data.event.startTime ?? "",
      endTime: data.event.endTime ?? "",
      timezone: data.event.timezone || browserTimezone(),
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
            [name]: type === "checkbox" ? checked : name === "photoLimitPerGuest" ? Number(value) : value,
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
      <div className="min-h-screen bg-white px-[15px] py-10 text-black">
        <p className="text-[10px] text-[#888]">Loading event…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white px-[15px] py-10 text-black">
        <Link href="/dashboard" className="text-[8px] text-[#888] uppercase tracking-[0.12em]">
          ← Back to dashboard
        </Link>
        <p className="mt-4 text-[10px] text-red-500">{error ?? "Event not found."}</p>
      </div>
    );
  }

  const { event } = data;
  const uniqueGuests = new Set(data.photos.map((p) => p.guestSessionId)).size;

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="px-[15px] py-2 border-b border-black">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-[8px] text-[#888] uppercase tracking-[0.12em]">
            ← Back
          </Link>
          <button
            type="button"
            onClick={openEdit}
            className="rounded-[20px] border-[1.5px] border-black px-3 py-[4px] text-[9px] font-[700] uppercase tracking-[0.08em]"
          >
            Edit
          </button>
        </div>
        <h1 className="text-[20px] font-[800] tracking-[-0.02em] mt-1">{event.name}</h1>
        <p className="text-[8px] text-[#888] tracking-[0.04em]">
          {event.date}
          {event.startTime && event.endTime ? ` · ${event.startTime}–${event.endTime}` : ""}
          {" "}· {event.photoLimitPerGuest} photos/guest
        </p>
      </div>

      {/* Stat grid */}
      <StatGrid
        stats={[
          { value: filteredPhotos.length, label: "Photos" },
          { value: uniqueGuests, label: "Guests" },
          { value: event.photoLimitPerGuest, label: "Limit", accent: true },
        ]}
      />

      {/* QR Section */}
      <section className="bg-black text-white px-[15px] py-4">
        <Overline className="text-[#555]">Scan to Join</Overline>
        <div className="flex justify-center my-3 bg-white rounded-[6px] p-3 mx-auto w-fit">
          <QRCode ref={qrRef} value={guestLink} size={140} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownloadQR}
            className="flex-1 bg-[#FF3C00] text-white text-center text-[10px] font-[800] tracking-[0.08em] uppercase rounded-[6px] py-[10px]"
          >
            Download QR
          </button>
          <button
            type="button"
            onClick={handleDownloadPoster}
            className="flex-1 border-[1.5px] border-white text-white text-center text-[10px] font-[700] tracking-[0.08em] uppercase rounded-[6px] py-[9px]"
          >
            Poster
          </button>
        </div>
      </section>

      <div className="border-b border-black" />

      {/* Share links */}
      <section className="px-[15px] py-3">
        <Overline className="mb-2">Share with Guests</Overline>

        {/* Guest link */}
        <div className="rounded-[6px] bg-[#F5F5F5] border border-[#E0E0E0] px-[11px] py-[9px] mb-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0 mr-2">
              <p className="text-[8px] font-[700] text-[#888] uppercase tracking-[0.12em]">Guest Link</p>
              <p className="text-[9px] font-mono tracking-[0.06em] text-black truncate">{guestLink}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopyLink(guestLink)}
              className="shrink-0 bg-black text-white text-[8px] font-[700] rounded-[4px] px-[10px] py-[5px]"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Gallery link */}
        <div className="rounded-[6px] bg-[#F5F5F5] border border-[#E0E0E0] px-[11px] py-[9px] mb-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0 mr-2">
              <p className="text-[8px] font-[700] text-[#888] uppercase tracking-[0.12em]">Public Gallery</p>
              <p className="text-[9px] font-mono tracking-[0.06em] text-black truncate">{galleryLink}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopyLink(galleryLink)}
              className="shrink-0 bg-black text-white text-[8px] font-[700] rounded-[4px] px-[10px] py-[5px]"
            >
              Copy
            </button>
          </div>
        </div>

        <Link
          href={`/gallery/${id}`}
          target="_blank"
          className="block w-full rounded-[6px] bg-[#F5F5F5] border border-[#E0E0E0] py-[9px] text-center text-[9px] font-[700] tracking-[0.06em] uppercase text-[#FF3C00]"
        >
          Open Gallery ↗
        </Link>
      </section>

      <div className="border-b border-black" />

      {/* Gallery / moderation section */}
      <section className="px-[15px] py-3">
        <div className="flex items-center justify-between mb-2">
          <Overline className="mb-0">Event Gallery</Overline>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => fetchEvent(true)}
              disabled={refreshing}
              className="text-[8px] font-[700] text-[#888] uppercase tracking-[0.08em] disabled:opacity-50"
            >
              {refreshing ? "…" : "Refresh"}
            </button>
            <span className="text-[8px] text-[#E0E0E0]">|</span>
            <button
              type="button"
              onClick={() => { setSlideshowIdx(0); setSlideshowOpen(true); }}
              disabled={filteredPhotos.length === 0}
              className="text-[8px] font-[700] text-[#888] uppercase tracking-[0.08em] disabled:opacity-50"
            >
              Slideshow
            </button>
          </div>
        </div>

        {lastRefreshed && (
          <p className="text-[8px] text-[#888] mb-2">Updated {lastRefreshed.toLocaleTimeString()}</p>
        )}

        {/* Tab row */}
        {event.moderationEnabled && (
          <div className="flex border border-black rounded-[6px] overflow-hidden mb-3">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`flex-1 py-[6px] text-[9px] font-[700] uppercase tracking-[0.08em] ${statusFilter === "all" ? "bg-black text-white" : "bg-white text-[#888]"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`flex-1 py-[6px] text-[9px] font-[700] uppercase tracking-[0.08em] border-l border-black ${statusFilter === "pending" ? "bg-black text-white" : "bg-white text-[#888]"}`}
            >
              Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          </div>
        )}

        {filteredPhotos.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[10px] text-[#888]">
              {statusFilter === "pending"
                ? "No photos waiting for review."
                : "No photos yet. Share your QR code to get things rolling."}
            </p>
          </div>
        ) : statusFilter === "pending" ? (
          <>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={bulkPending}
                className="flex-1 rounded-[6px] bg-black text-white py-[9px] text-[10px] font-[800] tracking-[0.08em] uppercase disabled:opacity-50"
              >
                {bulkPending ? "Processing…" : `Approve all (${pendingCount})`}
              </button>
              <button
                type="button"
                onClick={handleRejectAll}
                disabled={bulkPending}
                className="flex-1 rounded-[6px] border-[1.5px] border-black text-black py-[8px] text-[10px] font-[700] tracking-[0.08em] uppercase disabled:opacity-50"
              >
                {bulkPending ? "Processing…" : `Reject all`}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {filteredPhotos.map((photo) => (
                <div key={photo.id} className="rounded-[6px] border border-black overflow-hidden">
                  <div className="relative aspect-[3/4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.storageUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded-[4px] bg-black text-white px-[6px] py-[2px] text-[7px] font-[700]">
                      Pending
                    </span>
                  </div>
                  <div className="flex border-t border-black">
                    <button
                      type="button"
                      onClick={() => handleApprove(photo.id)}
                      className="flex-1 py-[7px] text-[9px] font-[800] uppercase bg-black text-white border-r border-black"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(photo.id)}
                      className="flex-1 py-[7px] text-[9px] font-[700] uppercase text-[#888]"
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
              className="w-full rounded-[6px] bg-black text-white py-[10px] text-[10px] font-[800] tracking-[0.08em] uppercase mb-3 disabled:opacity-50"
            >
              {zipping ? "Preparing ZIP…" : `Download all ${filteredPhotos.length} photo${filteredPhotos.length === 1 ? "" : "s"} as ZIP`}
            </button>
            <div className="grid grid-cols-3 gap-[3px]">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-[3px] overflow-hidden cursor-pointer"
                  onClick={() => { setSlideshowIdx(filteredPhotos.indexOf(photo)); setSlideshowOpen(true); }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbnailUrl ?? photo.storageUrl} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Slideshow overlay */}
      {slideshowOpen && filteredPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-[15px] py-3">
            <span className="text-[9px] text-[#888]">
              {slideshowIdx + 1} / {filteredPhotos.length}
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
              key={filteredPhotos[slideshowIdx].id}
              src={filteredPhotos[slideshowIdx].storageUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {filteredPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSlideshowIdx((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-[6px] bg-white/10 px-3 py-2 text-white text-sm"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setSlideshowIdx((prev) => (prev + 1) % filteredPhotos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] bg-white/10 px-3 py-2 text-white text-sm"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit event panel */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/50" onClick={() => setEditOpen(false)} />
          <div className="h-full w-full max-w-sm overflow-y-auto bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black bg-white px-[15px] py-3">
              <h2 className="text-[13px] font-[800]">Edit event</h2>
              <button type="button" onClick={() => setEditOpen(false)} className="text-[#888] text-[14px]">
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-[8px] p-[15px]">
              <div>
                <Overline>Event Name</Overline>
                <input
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                  className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] outline-none focus:border-black focus:bg-white"
                />
              </div>
              <div>
                <Overline>Date</Overline>
                <input
                  type="date"
                  name="date"
                  value={editForm.date}
                  onChange={handleEditChange}
                  required
                  className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] outline-none focus:border-black focus:bg-white"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Overline>Starts at</Overline>
                  <TimePicker value={editForm.startTime} onChange={(v) => setEditForm((p) => p ? { ...p, startTime: v } : p)} placeholder="--:--" />
                </div>
                <div className="flex-1">
                  <Overline>Ends at</Overline>
                  <TimePicker value={editForm.endTime} onChange={(v) => setEditForm((p) => p ? { ...p, endTime: v } : p)} placeholder="--:--" />
                </div>
              </div>
              <div>
                <Overline>Timezone</Overline>
                <select
                  name="timezone"
                  value={editForm.timezone}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, timezone: e.target.value } : p))}
                  className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] outline-none focus:border-black focus:bg-white"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <Overline>Description</Overline>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full resize-none rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] outline-none focus:border-black focus:bg-white"
                />
              </div>
              <div>
                <Overline>Photo Limit</Overline>
                <input
                  type="number"
                  min={1}
                  max={50}
                  name="photoLimitPerGuest"
                  value={editForm.photoLimitPerGuest}
                  onChange={handleEditChange}
                  className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] outline-none focus:border-black focus:bg-white"
                />
              </div>
              <label className="flex items-center gap-2 rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 cursor-pointer">
                <input type="checkbox" name="moderationEnabled" checked={editForm.moderationEnabled} onChange={handleEditChange} className="h-4 w-4 accent-black" />
                <span className="text-[10px] text-[#333]">Enable photo moderation</span>
              </label>
              {editError && <p className="text-[10px] text-red-500">{editError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-[6px] border-[1.5px] border-black py-[10px] text-[10px] font-[700] uppercase tracking-[0.08em]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-[6px] bg-black text-white py-[10px] text-[10px] font-[800] uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
