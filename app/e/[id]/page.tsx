"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/types";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------
type FilterKey = "none" | "bw" | "vintage" | "film" | "retro";

const FILTERS: Record<FilterKey, { label: string; css: string }> = {
  none:    { label: "Normal",  css: "" },
  bw:      { label: "B&W",     css: "grayscale(100%)" },
  vintage: { label: "Vintage", css: "sepia(60%) contrast(90%) brightness(110%) saturate(80%)" },
  film:    { label: "Film",    css: "contrast(110%) saturate(120%) brightness(95%)" },
  retro:   { label: "Retro",   css: "sepia(30%) hue-rotate(340deg) saturate(150%) contrast(85%) brightness(105%)" },
};

const FILTER_KEYS = Object.keys(FILTERS) as FilterKey[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type EventResponse = { event: Event };

function getOrCreateGuestSessionId(eventId: string) {
  if (typeof window === "undefined") return "";
  const key = `ddc_guest_session_${eventId}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

async function uploadWithRetry(
  url: string,
  body: string,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      // Don't retry 4xx client errors (they are deterministic)
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
    } catch (e) {
      lastError = e;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError ?? new Error("Upload failed after multiple attempts.");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GuestEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Event data
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Photo state
  const [remaining, setRemaining] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadRetrying, setUploadRetrying] = useState(false);
  const [photoLimitReached, setPhotoLimitReached] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"intro" | "camera" | "preview">("intro");
  const [videoReady, setVideoReady] = useState(false);

  // Camera controls
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("none");
  const [filterOpen, setFilterOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch event
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Event not found");
        }
        const json: EventResponse = await res.json();
        setEvent(json.event);
        setRemaining(json.event.photoLimitPerGuest);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load event.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  // ---------------------------------------------------------------------------
  // Stream helpers
  // ---------------------------------------------------------------------------
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  // ---------------------------------------------------------------------------
  // Start / flip camera
  // ---------------------------------------------------------------------------
  const startCamera = async (facing: "environment" | "user" = facingMode) => {
    setVideoReady(false);
    setPermissionDenied(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;

      // Torch capability detection
      const [track] = stream.getVideoTracks();
      const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchSupported(caps?.torch === true);
      setFlashOn(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.oncanplay = () => setVideoReady(true);
        await videoRef.current.play();
      }
      setStep("camera");
    } catch (e) {
      console.error(e);
      const isPermissionDenied =
        e instanceof DOMException &&
        (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
      if (isPermissionDenied) {
        setPermissionDenied(true);
      } else {
        setError("Could not start camera. Please try again.");
      }
    }
  };

  const flipCamera = async () => {
    stopStream();
    const next: "environment" | "user" =
      facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    try {
      await startCamera(next);
    } catch {
      setFacingMode(facingMode);
      await startCamera(facingMode);
    }
  };

  // ---------------------------------------------------------------------------
  // Flash / torch
  // ---------------------------------------------------------------------------
  const toggleFlash = async () => {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track) return;
    const next = !flashOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setFlashOn(next);
    } catch (e) {
      console.error("Torch toggle failed", e);
    }
  };

  // ---------------------------------------------------------------------------
  // Capture (with image compression)
  // ---------------------------------------------------------------------------
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const nativeWidth = video.videoWidth;
    const nativeHeight = video.videoHeight;
    if (!nativeWidth || !nativeHeight) {
      setError("Camera is not ready yet. Please try again.");
      return;
    }

    // Scale down to max 1920px on the long edge
    const MAX_DIMENSION = 1920;
    const longEdge = Math.max(nativeWidth, nativeHeight);
    const scale = longEdge > MAX_DIMENSION ? MAX_DIMENSION / longEdge : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(nativeWidth * scale);
    canvas.height = Math.round(nativeHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Bake active filter into the captured image
    const filterCss = FILTERS[activeFilter].css;
    if (filterCss) ctx.filter = filterCss;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // JPEG at 0.82 quality keeps file size under ~500 KB for typical shots
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setPreviewDataUrl(dataUrl);
    setStep("preview");
  };

  const resetPreview = () => {
    setPreviewDataUrl(null);
    setStep("camera");
  };

  // ---------------------------------------------------------------------------
  // Upload (with exponential backoff retry)
  // ---------------------------------------------------------------------------
  const uploadPhoto = async () => {
    if (!event || !previewDataUrl || remaining === null) return;
    if (remaining <= 0) {
      setPhotoLimitReached(true);
      return;
    }

    setUploading(true);
    setUploadRetrying(false);
    setError(null);
    try {
      const guestSessionId = getOrCreateGuestSessionId(event.id);
      const bodyStr = JSON.stringify({ dataUrl: previewDataUrl, guestSessionId });

      // Show "Retrying" state after first failure
      let attempt = 0;
      const res = await uploadWithRetry(
        `/api/events/${event.id}/photos`,
        bodyStr,
        3,
      );

      void attempt; // unused but kept for clarity

      if (!res.ok) {
        const json = await res.json();
        if (res.status === 403) {
          setPhotoLimitReached(true);
          stopStream();
          setShowThankYouModal(true);
        }
        throw new Error(json.error ?? "Failed to upload photo");
      }
      const newRemaining = remaining - 1;
      setRemaining(newRemaining);
      setPreviewDataUrl(null);
      if (newRemaining <= 0) {
        setPhotoLimitReached(true);
        stopStream();
        setShowThankYouModal(true);
      } else {
        setStep("camera");
      }
    } catch (e) {
      console.error(e);
      if (!photoLimitReached) {
        setError(e instanceof Error ? e.message : "Failed to upload photo.");
      }
    } finally {
      setUploading(false);
      setUploadRetrying(false);
    }
  };

  // Kick off retry indicator after a short delay
  useEffect(() => {
    if (!uploading) { setUploadRetrying(false); return; }
    const t = setTimeout(() => setUploadRetrying(true), 2500);
    return () => clearTimeout(t);
  }, [uploading]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-black px-4 py-10 text-zinc-50 sm:px-6">
        <p className="text-sm text-zinc-400">Loading event…</p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-black px-4 py-10 text-zinc-50 sm:px-6">
        <p className="text-sm text-red-400">
          {error ?? "This event could not be found."}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Ask the host to confirm you scanned the right QR code.
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black px-4 py-10 text-zinc-50 sm:px-6">
        <p className="text-sm text-red-400">This event could not be found.</p>
        <p className="mt-2 text-xs text-zinc-500">
          Ask the host to confirm you scanned the right QR code.
        </p>
      </div>
    );
  }

  const limitReached = photoLimitReached || (remaining !== null && remaining <= 0);

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Event camera
            </p>
            <h1 className="text-base font-semibold">{event.name}</h1>
            <p className="text-xs text-zinc-500">
              {event.date}
              {event.startTime && event.endTime
                ? ` • ${event.startTime}–${event.endTime}`
                : event.startTime
                  ? ` • from ${event.startTime}`
                  : ""}{" "}
              • {event.photoLimitPerGuest} photos per guest
            </p>
          </div>
          <Link
            href={`/dashboard/events/${event.id}`}
            className="text-[11px] text-zinc-500 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            Host view
          </Link>
        </header>

        {event.coverImageUrl && (
          <div className="mb-3 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.coverImageUrl} alt={event.name} className="h-32 w-full object-cover" />
          </div>
        )}

        {event.description && (
          <p className="mb-4 text-xs text-zinc-400">{event.description}</p>
        )}

        <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
          <span>
            {limitReached
              ? "Photo limit reached for this device."
              : remaining !== null
                ? `${remaining} photo${remaining === 1 ? "" : "s"} left`
                : null}
          </span>
          <span>No app • No login</span>
        </div>

        <div className="flex-1 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-3">
          {/* ---- Camera permission denied ---- */}
          {permissionDenied && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <div className="rounded-full border border-red-500/30 bg-red-500/10 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-red-400">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <line x1="2" y1="2" x2="22" y2="22"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">Camera access denied</p>
                <p className="mt-1 text-xs text-zinc-400">
                  To take photos, allow camera access in your browser settings.
                </p>
              </div>
              <div className="w-full space-y-2 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">How to enable</p>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2 text-xs text-zinc-400">
                  <p><span className="font-medium text-zinc-200">iOS Safari:</span> Settings → Safari → Camera → Allow</p>
                  <p><span className="font-medium text-zinc-200">Android Chrome:</span> Tap the lock icon in the address bar → Camera → Allow</p>
                  <p><span className="font-medium text-zinc-200">Desktop Chrome:</span> Click the camera icon in the address bar → Allow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => startCamera()}
                className="w-full rounded-full bg-zinc-50 px-6 py-2.5 text-sm font-medium text-black hover:bg-zinc-200"
              >
                Try again
              </button>
            </div>
          )}

          {/* ---- Intro ---- */}
          {!permissionDenied && step === "intro" && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-zinc-300">
              <p>When you&apos;re ready, open the camera to start shooting.</p>
              <button
                type="button"
                onClick={() => startCamera()}
                disabled={limitReached}
                className="rounded-full bg-zinc-50 px-6 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:bg-zinc-500"
              >
                {limitReached ? "Photo limit reached" : "Open camera"}
              </button>
            </div>
          )}

          {/* ---- Camera ---- */}
          {/* Video element is always mounted so videoRef is available when startCamera runs */}
          <div className={!permissionDenied && step === "camera" ? "flex h-full flex-col justify-between" : "hidden"}>
            {/* Video with filter dropdown overlay */}
            <div className="relative mb-3 aspect-[3/4] overflow-hidden rounded-2xl bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                playsInline
                className="h-full w-full object-cover transition-all duration-200"
                style={{ filter: FILTERS[activeFilter].css || undefined }}
              />

              {/* Filter dropdown — bottom-left of video */}
              {videoReady && (
                <div ref={filterMenuRef} className="absolute bottom-2 left-2">
                  {filterOpen && (
                    <div className="absolute bottom-full left-0 mb-1 flex flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-900/95 p-1.5 shadow-xl backdrop-blur-sm">
                      {FILTER_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveFilter(key); setFilterOpen(false); }}
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                            activeFilter === key
                              ? "bg-zinc-50 text-black"
                              : "text-zinc-300 hover:bg-zinc-800"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${activeFilter === key ? "bg-black" : "bg-transparent"}`} />
                          {FILTERS[key].label}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setFilterOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black/70"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M3 12h.01M12 3v.01M21 12h-.01M12 21v-.01M5.6 5.6l.01.01M18.4 5.6l-.01.01M5.6 18.4l.01-.01M18.4 18.4l-.01-.01" />
                    </svg>
                    {FILTERS[activeFilter].label}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom controls: Flip — Shutter — Flash */}
            <div className="grid grid-cols-3 items-center pb-2 pt-1">
              <div className="flex justify-center">
                {videoReady && (
                  <button
                    type="button"
                    onClick={flipCamera}
                    title="Flip camera"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/80 text-white hover:bg-zinc-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="m15 9-3-3-3 3" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={limitReached || !videoReady}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-zinc-200 bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-500 disabled:bg-zinc-600"
                >
                  <span className="h-10 w-10 rounded-full bg-zinc-900" />
                </button>
                {!videoReady && (
                  <p className="text-[11px] text-zinc-500">Starting camera…</p>
                )}
              </div>

              <div className="flex justify-center">
                {videoReady && torchSupported && (
                  <button
                    type="button"
                    onClick={toggleFlash}
                    title={flashOn ? "Flash on" : "Flash off"}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                      flashOn
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : "border-zinc-700 bg-zinc-800/80 text-white hover:bg-zinc-700"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                      <path d="M13 2L4.5 13.5H11L10 22L20.5 10.5H14L13 2Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ---- Preview ---- */}
          {!permissionDenied && step === "preview" && previewDataUrl && (
            <div className="flex h-full flex-col justify-between gap-3">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewDataUrl}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
                {activeFilter !== "none" && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-zinc-300 backdrop-blur-sm">
                    {FILTERS[activeFilter].label}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3 pb-1 pt-2">
                <p className="text-xs text-zinc-400">
                  Happy with this one?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetPreview}
                    disabled={uploading}
                    className="flex-1 rounded-full border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-100 disabled:opacity-50"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={uploadPhoto}
                    disabled={uploading}
                    className="flex-1 rounded-full bg-zinc-50 px-4 py-2 text-xs font-medium text-black disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {uploading
                      ? uploadRetrying
                        ? "Retrying…"
                        : "Uploading…"
                      : "Use photo"}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {error && step !== "preview" && !permissionDenied && (
          <p className="mt-3 text-xs text-red-400">
            {error} Try again or ask the host for help.
          </p>
        )}
      </main>

      {/* Thank-you modal */}
      {showThankYouModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-2xl">
            <div className="mb-4 text-5xl">🎉</div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-50">
              Thank you!
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              You&apos;ve used all your photos for{" "}
              <span className="font-medium text-zinc-200">{event?.name}</span>.
              Your shots are in the gallery.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/e/${id}/thanks`)}
              className="mt-6 w-full rounded-full bg-zinc-50 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
