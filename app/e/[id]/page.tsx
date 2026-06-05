"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/types";
import Overline from "@/app/components/Overline";
import StatGrid from "@/app/components/StatGrid";
import { getEventWindow, type WindowState } from "@/lib/eventWindow";

type FilterKey = "none" | "bw" | "vintage" | "film";

const FILTERS: Record<FilterKey, { label: string; css: string }> = {
  none:    { label: "Normal",  css: "" },
  bw:      { label: "B&W",     css: "grayscale(100%)" },
  vintage: { label: "Warm",    css: "sepia(60%) contrast(90%) brightness(110%) saturate(80%)" },
  film:    { label: "Fade",    css: "contrast(110%) saturate(120%) brightness(95%)" },
};

const FILTER_KEYS = Object.keys(FILTERS) as FilterKey[];

type EventResponse = { event: Event };

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

async function uploadWithRetry(url: string, body: string, maxAttempts = 3): Promise<Response> {
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
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadRetrying, setUploadRetrying] = useState(false);
  const [photoLimitReached, setPhotoLimitReached] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"intro" | "camera" | "preview">("intro");
  const [videoReady, setVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("none");
  const [photosTaken, setPhotosTaken] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const stopStream = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };

  useEffect(() => { return () => stopStream(); }, []);

  const startCamera = async (facing: "environment" | "user" = facingMode) => {
    setVideoReady(false);
    setPermissionDenied(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      streamRef.current = stream;
      const [track] = stream.getVideoTracks();
      const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchSupported(caps?.torch === true);
      setFlashOn(false);
      setStreamId((n) => n + 1);
      setStep("camera");
    } catch (e) {
      console.error(e);
      const isPermDenied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
      if (isPermDenied) setPermissionDenied(true);
      else setError("Could not start camera. Please try again.");
    }
  };

  // Track stream identity so the attach-effect re-runs after flip
  const [streamId, setStreamId] = useState(0);

  // Attach stream to video element once the DOM renders
  useEffect(() => {
    if (step !== "camera" || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.srcObject === streamRef.current) return;
    video.srcObject = streamRef.current;
    video.oncanplay = () => setVideoReady(true);
    video.play().catch(() => {});
  }, [step, streamId]);

  const flipCamera = async () => {
    stopStream();
    const next: "environment" | "user" = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    try { await startCamera(next); } catch { setFacingMode(facingMode); await startCamera(facingMode); }
  };

  const toggleFlash = async () => {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track) return;
    const next = !flashOn;
    try { await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }); setFlashOn(next); } catch (e) { console.error("Torch toggle failed", e); }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const nW = video.videoWidth, nH = video.videoHeight;
    if (!nW || !nH) { setError("Camera is not ready yet."); return; }
    const MAX_DIM = 1920;
    const scale = Math.max(nW, nH) > MAX_DIM ? MAX_DIM / Math.max(nW, nH) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(nW * scale);
    canvas.height = Math.round(nH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const filterCss = FILTERS[activeFilter].css;
    if (filterCss) ctx.filter = filterCss;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreviewDataUrl(canvas.toDataURL("image/jpeg", 0.82));
    setStep("preview");
  };

  const resetPreview = () => { setPreviewDataUrl(null); setStep("camera"); };

  const uploadPhoto = async () => {
    if (!event || !previewDataUrl || remaining === null) return;
    if (remaining <= 0) { setPhotoLimitReached(true); return; }
    setUploading(true);
    setUploadRetrying(false);
    setError(null);
    try {
      const guestSessionId = getOrCreateGuestSessionId(event.id);
      const res = await uploadWithRetry(`/api/events/${event.id}/photos`, JSON.stringify({ dataUrl: previewDataUrl, guestSessionId }), 3);
      if (!res.ok) {
        const json = await res.json();
        // Event ran out mid-session → send the guest to the warm ending page.
        if (res.status === 403 && json.reason === "event_ended") {
          stopStream();
          setRedirecting(true);
          router.replace(`/e/${id}/ended`);
          return;
        }
        // Limit reached → thank-you flow (ignore the not-started edge case).
        if (res.status === 403 && json.reason !== "event_not_started") {
          setPhotoLimitReached(true);
          stopStream();
          setShowThankYouModal(true);
        }
        throw new Error(json.error ?? "Failed to upload photo");
      }
      const newRemaining = remaining - 1;
      const newTaken = photosTaken + 1;
      setRemaining(newRemaining);
      setPhotosTaken(newTaken);
      writeCachedCount(event.id, newTaken);
      setPreviewDataUrl(null);
      if (newRemaining <= 0) { setPhotoLimitReached(true); stopStream(); setShowThankYouModal(true); }
      else setStep("camera");
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

  // ── CAMERA VIEW (dark) ──
  if (step === "camera" || step === "preview") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Camera header */}
        <div className="flex items-center justify-between px-[15px] py-2 border-b border-[#1A1A1A]">
          <div>
            <p className="text-[8px] font-[700] tracking-[0.18em] uppercase text-[#555]">Now Shooting</p>
            <p className="text-[12px] font-[800] text-white">{event.name}</p>
          </div>
          <span className="bg-[#FF3C00] text-white text-[10px] font-[800] rounded-[4px] px-[8px] py-[3px]">
            {remaining ?? 0} LEFT
          </span>
        </div>

        {step === "camera" && (
          <>
            {/* Viewfinder */}
            <div className="relative mx-3 mt-[10px] aspect-[3/4] rounded-[8px] bg-[#111] border border-[#1A1A1A] overflow-hidden">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                playsInline
                className="h-full w-full object-cover"
                style={{ filter: FILTERS[activeFilter].css || undefined }}
              />
              {/* Rule of thirds */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/[0.08]" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/[0.08]" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/[0.08]" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/[0.08]" />
              </div>
              {/* Corner brackets */}
              <div className="absolute top-[10px] left-[10px] w-[14px] h-[14px] border-t-2 border-l-2 border-[#FF3C00]" />
              <div className="absolute top-[10px] right-[10px] w-[14px] h-[14px] border-t-2 border-r-2 border-[#FF3C00]" />
              <div className="absolute bottom-[10px] left-[10px] w-[14px] h-[14px] border-b-2 border-l-2 border-[#FF3C00]" />
              <div className="absolute bottom-[10px] right-[10px] w-[14px] h-[14px] border-b-2 border-r-2 border-[#FF3C00]" />
              {/* Center focus */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[46px] h-[46px] rounded-full border border-white/20" />
              {/* Film tag */}
              <div className="absolute bottom-[10px] left-[10px] bg-black/50 rounded-[2px] px-[5px] py-[2px]">
                <span className="text-[8px] font-mono tracking-[0.06em] text-[#FF3C00]">DDC-36</span>
              </div>
              {/* Exposure */}
              <div className="absolute bottom-[10px] right-[10px]">
                <span className="text-[8px] font-mono tracking-[0.04em] text-[#444]">f/1.8 · ISO400</span>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex border-t border-b border-[#1A1A1A] mx-0 mt-2">
              <div className="flex-1 text-center py-[8px]">
                <p className="text-[11px] font-[800] text-white">{FILTERS[activeFilter].label}</p>
                <p className="text-[7px] font-[700] tracking-[0.12em] uppercase text-[#555]">Filter</p>
              </div>
              <div className="flex-1 text-center py-[8px] border-l border-r border-[#1A1A1A]">
                <p className="text-[11px] font-[800] text-white">{photosTaken} / {event.photoLimitPerGuest}</p>
                <p className="text-[7px] font-[700] tracking-[0.12em] uppercase text-[#555]">Shots Used</p>
              </div>
              <div className="flex-1 text-center py-[8px]">
                <p className={`text-[11px] font-[800] ${flashOn ? "text-[#FF3C00]" : "text-white"}`}>{flashOn ? "ON" : "OFF"}</p>
                <p className="text-[7px] font-[700] tracking-[0.12em] uppercase text-[#555]">Flash</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-[22px] py-3">
              <button type="button" onClick={flipCamera} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#1A1A1A] border border-[#333]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={limitReached || !videoReady}
                className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#FF3C00] border-[3px] border-[#CC3000] disabled:opacity-40"
              >
                <span className="h-[46px] w-[46px] rounded-full bg-[#E83000]" />
              </button>
              <div className="w-[34px] h-[34px] flex items-center justify-center">
                {torchSupported && (
                  <button type="button" onClick={toggleFlash} className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border ${flashOn ? "bg-[#FF3C00] border-[#FF3C00]" : "bg-[#1A1A1A] border-[#333]"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-white">
                      <path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filter strip */}
            <div className="flex gap-[5px] px-3 pb-3">
              {FILTER_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFilter(key)}
                  className={`flex-1 py-[7px] rounded-[4px] text-[9px] font-[800] uppercase tracking-[0.04em] ${
                    activeFilter === key ? "bg-[#FF3C00] text-white" : "bg-[#1A1A1A] text-[#555]"
                  }`}
                >
                  {FILTERS[key].label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Preview step */}
        {step === "preview" && previewDataUrl && (
          <div className="flex flex-1 flex-col px-3 pt-2 pb-3">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[8px] bg-[#111]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewDataUrl} alt="Preview" className="h-full w-full object-cover" />
              {activeFilter !== "none" && (
                <span className="absolute bottom-2 right-2 rounded-[4px] bg-black/60 px-2 py-[2px] text-[9px] text-white">{FILTERS[activeFilter].label}</span>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-[10px] text-[#888]">Happy with this one?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetPreview}
                  disabled={uploading}
                  className="flex-1 rounded-[6px] border-[1.5px] border-white text-white py-[9px] text-[10px] font-[700] uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={uploadPhoto}
                  disabled={uploading}
                  className="flex-1 rounded-[6px] bg-[#FF3C00] text-white py-[10px] text-[10px] font-[800] uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  {uploading ? (uploadRetrying ? "Retrying…" : "Uploading…") : "Use photo"}
                </button>
              </div>
              {error && <p className="text-[10px] text-red-400">{error}</p>}
            </div>
          </div>
        )}

        {/* Hidden video for ref */}
        {step === "preview" && (
          <video ref={videoRef} playsInline className="hidden" />
        )}

        {/* Thank-you modal */}
        {showThankYouModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div className="w-full max-w-sm rounded-[8px] bg-white text-black p-6 text-center">
              <h2 className="text-[22px] font-[800] tracking-[-0.02em]">Thank you!</h2>
              <p className="mt-2 text-[10px] text-[#555] leading-[1.6]">
                You&apos;ve used all your photos for <span className="font-[700] text-black">{event?.name}</span>. Your shots are in the gallery.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/e/${id}/thanks`)}
                className="mt-4 w-full rounded-[6px] bg-black text-white py-[11px] text-[10px] font-[800] uppercase tracking-[0.08em]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── INTRO VIEW (light) ──
  return (
    <div className="min-h-screen bg-white text-black">
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

      {/* Permission denied state */}
      {permissionDenied && (
        <section className="px-[15px] py-4 border-b border-black">
          <p className="text-[10px] font-[700] text-red-500 mb-2">Camera access denied</p>
          <p className="text-[10px] text-[#555] leading-[1.6] mb-3">
            To take photos, allow camera access in your browser settings.
          </p>
          <button type="button" onClick={() => startCamera()} className="w-full rounded-[6px] bg-black text-white py-[11px] text-[10px] font-[800] uppercase tracking-[0.08em]">
            Try again
          </button>
        </section>
      )}

      {/* Before you shoot */}
      {!permissionDenied && (
        <>
          <section className="px-[15px] py-[13px] border-b border-black">
            <Overline className="mb-2">Before You Shoot</Overline>
            <div className="space-y-3">
              {[
                { n: "1", text: "Allow camera access when prompted by your browser.", accent: false },
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

          {/* CTA */}
          <section className="px-[15px] py-[14px]">
            <button
              type="button"
              onClick={() => startCamera()}
              disabled={limitReached}
              className="w-full rounded-[6px] bg-[#FF3C00] text-white py-[14px] text-[13px] font-[800] uppercase tracking-[0.08em] disabled:opacity-50"
            >
              {limitReached ? "Photo limit reached" : "Open camera →"}
            </button>
            <p className="text-center text-[9px] text-[#AAA] mt-2">
              {event.photoLimitPerGuest} shots · Moderation {event.moderationEnabled ? "on" : "off"} · No account needed
            </p>
          </section>
        </>
      )}

      {error && step === "intro" && !permissionDenied && (
        <p className="px-[15px] text-[10px] text-red-500">{error}</p>
      )}
    </div>
  );
}
