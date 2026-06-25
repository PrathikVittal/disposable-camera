"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import type { Event } from "@/lib/types";
import TimePicker from "@/app/components/TimePicker";
import Overline from "@/app/components/Overline";
import { getTimezones, browserTimezone } from "@/lib/timezones";

type CreateEventForm = {
  name: string;
  date: string;
  description: string;
  photoLimitPerGuest: number;
  startTime: string;
  endTime: string;
  timezone: string;
  moderationEnabled: boolean;
};

const TIMEZONES = getTimezones();

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
    timezone: "",
    moderationEnabled: false,
  });

  // Default the timezone to the host's browser timezone (set after mount to
  // avoid an SSR/client hydration mismatch on the <select> value).
  useEffect(() => {
    setForm((prev) => (prev.timezone ? prev : { ...prev, timezone: browserTimezone() }));
  }, []);

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
        timezone: browserTimezone(),
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

  const increment = () => setForm((p) => ({ ...p, photoLimitPerGuest: Math.min(50, p.photoLimitPerGuest + 1) }));
  const decrement = () => setForm((p) => ({ ...p, photoLimitPerGuest: Math.max(1, p.photoLimitPerGuest - 1) }));

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Dark header */}
      <header className="bg-black text-white px-[15px] pt-2 pb-4 border-b border-black">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[14px] font-[800] tracking-[0.18em]">
            DDC
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="rounded-[6px] border-[1.5px] border-white text-white px-3 py-[5px] text-[9px] font-[700] tracking-[0.08em] uppercase"
          >
            Sign out
          </button>
        </div>
        <Overline className="text-[#555]">Host Dashboard</Overline>
        <h1 className="text-[22px] font-[800] tracking-[-0.02em] leading-tight">
          Hello, {session?.user?.name ?? session?.user?.email ?? "there"}.
        </h1>
        <p className="text-[9px] text-[#555] mt-0.5">
          {events.length} active event{events.length === 1 ? "" : "s"}
        </p>
      </header>

      {/* Create event form */}
      <form onSubmit={handleSubmit} className="px-[15px] py-[13px] border-b border-black">
        <Overline className="mb-2">Create New Event</Overline>

        <div className="space-y-[8px]">
          <div>
            <Overline>Event Name</Overline>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Summer rooftop party"
              className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
            />
          </div>

          <div>
            <Overline>Date</Overline>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none focus:border-black focus:bg-white"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Overline>Starts at</Overline>
              <TimePicker
                value={form.startTime}
                onChange={(v) => setForm((prev) => ({ ...prev, startTime: v }))}
                placeholder="--:--"
              />
            </div>
            <div className="flex-1">
              <Overline>Ends at</Overline>
              <TimePicker
                value={form.endTime}
                onChange={(v) => setForm((prev) => ({ ...prev, endTime: v }))}
                placeholder="--:--"
              />
            </div>
          </div>

          <div>
            <Overline>Timezone</Overline>
            <select
              name="timezone"
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none focus:border-black focus:bg-white"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <p className="mt-1 text-[8px] text-[#888]">Start and end times are interpreted in this timezone.</p>
          </div>

          <div>
            <Overline>Description (optional)</Overline>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              placeholder="What should guests know..."
              className="w-full resize-none rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
            />
          </div>

          {/* Cover photo upload */}
          <div>
            <Overline>Cover Photo (optional)</Overline>
            <div className="flex items-start gap-2">
              <label className="flex-1 flex cursor-pointer items-center justify-center rounded-[6px] border border-dashed border-[#CCC] bg-[#F5F5F5] px-[10px] py-[10px] text-[9px] text-[#AAA]">
                {coverPreview ? "Change image" : "↑ Upload cover photo"}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverChange}
                />
              </label>
              {coverPreview && (
                <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[4px] border border-[#E0E0E0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setCoverPreview(null); setCoverDataUrl(""); if (coverInputRef.current) coverInputRef.current.value = ""; }}
                    className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-black text-[8px] text-white"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Photo limit stepper */}
          <div>
            <Overline>Photos Per Guest</Overline>
            <div className="flex items-center rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-[6px]">
              <span className="flex-1 text-[10px] text-[#888]">Photo limit</span>
              <button
                type="button"
                onClick={decrement}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-black text-white text-[12px] font-[800]"
              >
                −
              </button>
              <span className="w-8 text-center text-[14px] font-[800]">{form.photoLimitPerGuest}</span>
              <button
                type="button"
                onClick={increment}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-black text-white text-[12px] font-[800]"
              >
                +
              </button>
            </div>
          </div>

          {/* Moderation checkbox */}
          <label className="flex items-center gap-2 rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 cursor-pointer">
            <input
              type="checkbox"
              name="moderationEnabled"
              checked={form.moderationEnabled}
              onChange={handleChange}
              className="h-4 w-4 rounded-[3px] border-[1.5px] border-black accent-black"
            />
            <span className="text-[10px] text-[#333]">Enable photo moderation</span>
          </label>
        </div>

        {error && (
          <p className="mt-2 text-[10px] font-[600] text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-3 w-full rounded-[6px] bg-black text-white py-[11px] text-[10px] font-[800] tracking-[0.08em] uppercase disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating event…" : "Create event →"}
        </button>
      </form>

      {/* Event list */}
      <section className="px-[15px] py-[12px]">
        <Overline className="mb-2">Your Events</Overline>
        <div className="space-y-2">
          {loading ? (
            <p className="text-[10px] text-[#888]">Loading events…</p>
          ) : events.length === 0 ? (
            <p className="text-[10px] text-[#888]">
              No events yet. Create your first event above.
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-[8px] bg-black px-3 py-[10px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {event.coverImageUrl && (
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-[4px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-[800] text-white truncate">{event.name}</p>
                    <p className="text-[8px] text-[#555] tracking-[0.04em]">
                      {event.date} · {event.photoLimitPerGuest} photos/guest · Mod {event.moderationEnabled ? "on" : "off"}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="shrink-0 bg-white text-black text-[9px] font-[800] rounded-[4px] px-[10px] py-[6px]"
                >
                  Open &rarr;
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
