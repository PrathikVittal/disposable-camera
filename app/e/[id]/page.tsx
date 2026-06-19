"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/types";
import Overline from "@/app/components/Overline";
import StatGrid from "@/app/components/StatGrid";
import { getEventWindow, type WindowState } from "@/lib/eventWindow";

type EventResponse = { event: Event };

// Originals are capped client-side at ~12MP before upload — keeps the file lean
// for weak event Wi-Fi while staying print-worthy.
const ORIGINAL_MAX_EDGE = 4000;
const ORIGINAL_QUALITY = 0.92;

function getOrCreateGuestSessionId(eventId: string) {
  if (typeof window === "undefined") return "";
  const key = `ddc_guest_session_${eventId}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const gid = crypto.randomUUID();
  window.localStorage.setItem(key, gid);
  return gid;
}

// Read the guest's session id without minting a new one. Returns null if the
// guest hasn't uploaded anything yet (no id created).
function readGuestSessionId(eventId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`ddc_guest_session_${eventId}`);
}

// Local cache of how many photos this guest has taken — lets the UI show the
// right "shots left" instantly on refresh, before the server count arrives.
const countCacheKey = (eventId: string) => `ddc_guest_count_${eventId}`;

function readCachedCount(eventId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(countCacheKey(eventId));
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function writeCachedCount(eventId: string, count: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(countCacheKey(eventId), String(count));
}

function isHeic(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

// Downscale an image blob to a max long edge and re-encode as JPEG.
function downscaleToJpegBlob(
  srcBlob: Blob,
  maxEdge: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(srcBlob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) {
        reject(new Error("Could not read image dimensions."));
        return;
      }
      const scale = Math.max(w, h) > maxEdge ? maxEdge / Math.max(w, h) : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode image."))),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image."));
    };
    img.src = url;
  });
}

// Convert HEIC→JPEG (iPhone) if needed, then cap to ~12MP. The result is the
// "original" we upload.
async function processCaptureToBlob(file: File): Promise<Blob> {
  let blob: Blob = file;
  if (isHeic(file)) {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: ORIGINAL_QUALITY,
    });
    blob = Array.isArray(result) ? result[0] : result;
  }
  return downscaleToJpegBlob(blob, ORIGINAL_MAX_EDGE, ORIGINAL_QUALITY);
}

// Retry a JSON POST with exponential backoff. 4xx responses are returned (not
// retried) so the caller can branch on the status/reason.
async function postWithRetry(url: string, body: string, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
    } catch (e) {
      lastError = e;
    }
    if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }
  throw lastError ?? new Error("Request failed after multiple attempts.");
}

// Retry the direct-to-S3 PUT of the original.
async function putWithRetry(url: string, blob: Blob, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
    } catch (e) {
      lastError = e;
    }
    if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }
  throw lastError ?? new Error("Upload failed after multiple attempts.");
}

export default function GuestEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowState, setWindowState] = useState<WindowState | null>(null);
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadRetrying, setUploadRetrying] = useState(false);
  const [photoLimitReached, setPhotoLimitReached] = useState(false);
  const [photosTaken, setPhotosTaken] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) { const json = await res.json(); throw new Error(json.error ?? "Event not found"); }
        const json: EventResponse = await res.json();
        setEvent(json.event);

        // ── Time-window gate ──
        const win = getEventWindow(json.event);
        if (win.state === "ended") {
          setRedirecting(true);
          router.replace(`/e/${id}/ended`);
          return;
        }
        setWindowState(win.state);
        setStartsAt(win.startsAt);

        // ── Photo count: instant cache, then authoritative server value ──
        const limit = json.event.photoLimitPerGuest;
        const cached = readCachedCount(json.event.id);
        if (cached !== null) {
          setPhotosTaken(cached);
          setRemaining(Math.max(0, limit - cached));
        } else {
          setRemaining(limit);
        }

        const gid = readGuestSessionId(json.event.id);
        if (gid) {
          try {
            const cRes = await fetch(`/api/events/${json.event.id}/photos?guestSessionId=${encodeURIComponent(gid)}`);
            if (cRes.ok) {
              const { count } = await cRes.json();
              if (typeof count === "number") {
                setPhotosTaken(count);
                setRemaining(Math.max(0, limit - count));
                writeCachedCount(json.event.id, count);
                // Returning guest who already used every shot → thank-you page.
                if (count >= limit) {
                  setRedirecting(true);
                  router.replace(`/e/${id}/thanks`);
                  return;
                }
              }
            }
          } catch (e) {
            // Non-fatal: fall back to cached/limit value already set above.
            console.error("Failed to rehydrate photo count", e);
          }
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load event.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, router]);

  const openCamera = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  // The native OS camera already shows its own "Retake / Use Photo" confirm, so
  // we skip a second web-side preview: process the captured photo and upload it
  // straight away.
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same/next shot
    if (!file) return;
    setError(null);
    setProcessing(true);
    let blob: Blob;
    try {
      blob = await processCaptureToBlob(file);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not process that photo. Please try again.");
      setProcessing(false);
      return;
    }
    setProcessing(false);
    await uploadBlob(blob);
  };

  // Handle terminal upload rejections. Returns true if the caller should stop.
  const handleUploadRejection = (status: number, reason?: string): boolean => {
    if (status === 403 && reason === "event_ended") {
      setRedirecting(true);
      router.replace(`/e/${id}/ended`);
      return true;
    }
    if (status === 403 && reason === "limit_reached") {
      setPhotoLimitReached(true);
      setRedirecting(true);
      router.replace(`/e/${id}/thanks`);
      return true;
    }
    return false;
  };

  const uploadBlob = async (blob: Blob) => {
    if (!event || remaining === null) return;
    if (remaining <= 0) { setPhotoLimitReached(true); return; }
    setUploading(true);
    setUploadRetrying(false);
    setError(null);
    try {
      const guestSessionId = getOrCreateGuestSessionId(event.id);

      // 1. Get a presigned upload slot (re-checks limit + time window).
      const presignRes = await postWithRetry(
        `/api/events/${event.id}/photos/presign`,
        JSON.stringify({ guestSessionId }),
        2,
      );
      if (!presignRes.ok) {
        const json = await presignRes.json().catch(() => ({}));
        if (handleUploadRejection(presignRes.status, json.reason)) return;
        throw new Error(json.error ?? "Could not start upload.");
      }
      const { uploadUrl, key } = await presignRes.json();

      // 2. Upload the original directly to S3.
      const putRes = await putWithRetry(uploadUrl, blob, 3);
      if (!putRes.ok) throw new Error("Failed to upload photo. Please try again.");

      // 3. Finalize — server makes the display + thumbnail derivatives.
      const finRes = await postWithRetry(
        `/api/events/${event.id}/photos`,
        JSON.stringify({ key, guestSessionId }),
        3,
      );
      if (!finRes.ok) {
        const json = await finRes.json().catch(() => ({}));
        if (handleUploadRejection(finRes.status, json.reason)) return;
        throw new Error(json.error ?? "Failed to save photo.");
      }

      // Success.
      const newRemaining = remaining - 1;
      const newTaken = photosTaken + 1;
      setRemaining(newRemaining);
      setPhotosTaken(newTaken);
      writeCachedCount(event.id, newTaken);
      if (newRemaining <= 0) {
        setPhotoLimitReached(true);
        setRedirecting(true);
        router.replace(`/e/${id}/thanks`);
        return;
      }
    } catch (e) {
      console.error(e);
      if (!photoLimitReached) setError(e instanceof Error ? e.message : "Failed to upload photo.");
    } finally {
      setUploading(false);
      setUploadRetrying(false);
    }
  };

  useEffect(() => {
    if (!uploading) { setUploadRetrying(false); return; }
    const t = setTimeout(() => setUploadRetrying(true), 2500);
    return () => clearTimeout(t);
  }, [uploading]);

  if (loading || redirecting) return <div className="min-h-screen bg-white px-[15px] py-10"><p className="text-[10px] text-[#888]">Loading event…</p></div>;
  if (error && !event) return <div className="min-h-screen bg-white px-[15px] py-10"><p className="text-[10px] text-red-500">{error}</p></div>;
  if (!event) return <div className="min-h-screen bg-white px-[15px] py-10"><p className="text-[10px] text-red-500">Event not found.</p></div>;

  // ── BEFORE-START VIEW — event isn't open yet, block the whole page ──
  if (windowState === "before") {
    const startLabel = startsAt
      ? startsAt.toLocaleString(undefined, {
          timeZone: event.timezone || undefined,
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-[15px] text-center text-black">
        <div className="max-w-sm space-y-5">
          <span className="text-[14px] font-[800] tracking-[0.18em]">
            DD<span className="text-[#FF3C00]">C</span>
          </span>
          <h1 className="text-[26px] font-[800] tracking-[-0.02em] leading-tight">
            Not just yet.
          </h1>
          <p className="text-[12px] font-[700] text-black">{event.name}</p>
          <p className="text-[10px] leading-[1.7] text-[#555]">
            The camera opens when the event starts. Come back at the time below —
            we&apos;ll be ready for your shots.
          </p>
          <div className="rounded-[6px] border border-black bg-[#F5F5F5] px-4 py-3">
            <p className="text-[8px] font-[700] uppercase tracking-[0.12em] text-[#888]">Doors open</p>
            <p className="mt-1 text-[11px] font-[800] text-black">{startLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  const limitReached = photoLimitReached || (remaining !== null && remaining <= 0);
  const busy = processing || uploading;

  // ── INTRO VIEW (light) ──
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Hidden native camera input — full-resolution capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Nav */}
      <nav className="flex items-center justify-between px-[15px] py-2 border-b border-black">
        <span className="text-[14px] font-[800] tracking-[0.18em]">
          DD<span className="text-[#FF3C00]">C</span>
        </span>
        <span className="text-[9px] font-[700] text-[#888] tracking-[0.06em] uppercase">No app · No login</span>
      </nav>

      {/* Event info card */}
      <section className="bg-black text-white px-[15px] py-[14px] border-b border-black">
        <Overline className="text-[#555]">You&apos;re Invited to Shoot</Overline>
        <h1 className="text-[22px] font-[800] tracking-[-0.02em] leading-tight">{event.name}</h1>
        <p className="text-[9px] text-[#555] mt-0.5">
          {event.date}
          {event.startTime && event.endTime ? ` · ${event.startTime}–${event.endTime}` : ""}
        </p>
      </section>

      {/* Stat grid */}
      <StatGrid
        stats={[
          { value: remaining ?? event.photoLimitPerGuest, label: "Shots Left", accent: true },
          { value: photosTaken, label: "Taken" },
        ]}
      />

      {/* Before you shoot — only on the first visit */}
      {photosTaken === 0 && (
        <section className="px-[15px] py-[13px] border-b border-black">
          <Overline className="mb-2">Before You Shoot</Overline>
          <div className="space-y-3">
            {[
              { n: "1", text: "Tap below to open your camera — allow access if your phone asks.", accent: false },
              { n: "2", text: `Take up to ${event.photoLimitPerGuest} photos. Used shots cannot be undone.`, accent: false },
              { n: "3", text: "Close the tab when done — photos auto-save to the gallery.", accent: true },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-[10px]">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-[800] text-white ${s.accent ? "bg-[#FF3C00]" : "bg-black"}`}>
                  {s.n}
                </span>
                <p className="text-[10px] text-[#555] leading-[1.5]">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="px-[15px] py-[14px]">
        <button
          type="button"
          onClick={openCamera}
          disabled={limitReached || busy}
          className="w-full rounded-[6px] bg-[#FF3C00] text-white py-[14px] text-[13px] font-[800] uppercase tracking-[0.08em] disabled:opacity-50"
        >
          {limitReached
            ? "Photo limit reached"
            : uploading
              ? (uploadRetrying ? "Retrying…" : "Uploading…")
              : processing
                ? "Processing…"
                : photosTaken > 0
                  ? "Take another shot →"
                  : "Open camera →"}
        </button>
        <p className="text-center text-[9px] text-[#AAA] mt-2">
          {event.photoLimitPerGuest} shots · Moderation {event.moderationEnabled ? "on" : "off"} · No account needed
        </p>
        {error && <p className="mt-2 text-center text-[10px] text-red-500">{error}</p>}
      </section>
    </div>
  );
}
