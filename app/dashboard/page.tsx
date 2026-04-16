"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import type { Event } from "@/lib/types";
import TimePicker from "@/app/components/TimePicker";

type CreateEventForm = {
  name: string;
  date: string;
  description: string;
  photoLimitPerGuest: number;
  startTime: string;
  endTime: string;
  moderationEnabled: boolean;
};

const MAX_COVER_DIMENSION = 1200;

function isHeic(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

async function normalizeToBlob(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(result) ? result[0] : result;
}

async function resizeImageToDataUrl(file: File): Promise<string> {
  const blob = await normalizeToBlob(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = w > MAX_COVER_DIMENSION || h > MAX_COVER_DIMENSION
        ? Math.min(MAX_COVER_DIMENSION / w, MAX_COVER_DIMENSION / h)
        : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverDataUrl, setCoverDataUrl] = useState<string>("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CreateEventForm>({
    name: "",
    date: "",
    description: "",
    photoLimitPerGuest: 10,
    startTime: "",
    endTime: "",
    moderationEnabled: false,
  });

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) throw new Error("Failed to load events");
        const json = await res.json();
        setEvents(json.events ?? []);
      } catch (e) {
        console.error(e);
        setError("Failed to load events.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox"
      ? (e.target as HTMLInputElement).checked
      : false;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "photoLimitPerGuest"
            ? Number(value)
            : value,
    }));
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setCoverDataUrl(dataUrl);
      setCoverPreview(dataUrl);
    } catch {
      setError("Failed to process image. Please try a different file.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          coverImageUrl: coverDataUrl || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to create event");
      }
      const json = await res.json();
      setEvents((prev) => [json.event, ...prev]);
      setForm({
        name: "",
        date: "",
        description: "",
        photoLimitPerGuest: 10,
        startTime: "",
        endTime: "",
        moderationEnabled: false,
      });
      setCoverDataUrl("");
      setCoverPreview(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to create event.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-12">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Host dashboard
            </h1>
            {session?.user && (
              <p className="mt-1 text-sm text-zinc-400">
                Signed in as{" "}
                <span className="font-medium text-zinc-200">
                  {session.user.name ?? session.user.email}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="space-y-8">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
          >
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Create event
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Minimal setup: name, date, and a photo limit per guest.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Event name
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Summer rooftop party"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-400"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    required
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">
                      Starts at
                    </label>
                    <TimePicker
                      value={form.startTime}
                      onChange={(v) => setForm((prev) => ({ ...prev, startTime: v }))}
                      placeholder="--:--"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">
                      Ends at
                    </label>
                    <TimePicker
                      value={form.endTime}
                      onChange={(v) => setForm((prev) => ({ ...prev, endTime: v }))}
                      placeholder="--:--"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Optional: What should guests know when they scan the QR code?"
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                />
              </div>

              {/* Cover image upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Cover image <span className="text-zinc-500">(optional)</span>
                </label>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" x2="12" y1="3" y2="15" />
                      </svg>
                      {coverPreview ? "Change image" : "Upload cover photo"}
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverChange}
                      />
                    </label>
                  </div>
                  {coverPreview && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setCoverPreview(null); setCoverDataUrl(""); if (coverInputRef.current) coverInputRef.current.value = ""; }}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Photo limit per guest
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    name="photoLimitPerGuest"
                    value={form.photoLimitPerGuest}
                    onChange={handleChange}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-400"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Enforced per-device in this MVP.
                  </p>
                </div>
                <div className="flex items-start pt-6">
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      name="moderationEnabled"
                      checked={form.moderationEnabled}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-zinc-50"
                    />
                    Enable photo moderation
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-zinc-50 px-4 py-2.5 text-sm font-medium text-black shadow-sm transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {submitting ? "Creating event…" : "Create event"}
            </button>
          </form>

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Your events
              </h2>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-zinc-400">Loading events…</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No events yet. Create your first event above.
                </p>
              ) : (
                <ul className="space-y-3">
                  {events.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {event.coverImageUrl && (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-700">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <p className="font-medium text-zinc-100">
                            {event.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {event.date} · {event.photoLimitPerGuest} photos/guest · Moderation {event.moderationEnabled ? "on" : "off"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs">
                        <Link
                          href={`/dashboard/events/${event.id}`}
                          className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
                        >
                          Open event
                        </Link>
                        <Link
                          href={`/e/${event.id}`}
                          className="text-[11px] text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
                        >
                          Guest link
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
