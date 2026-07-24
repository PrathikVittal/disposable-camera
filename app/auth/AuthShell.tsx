"use client";

// Shared split-screen shell for the auth pages (login / signup).
// Desktop: review-quote photo panel on the left, credentials on the right.
// Mobile: the same photo becomes a dimmed (54%) full-screen background with
// ONLY the credentials card on top — no quote text.

import { useState } from "react";

const ACCENT = "#4F46E5";
const PHOTO = "/auth/login-photo.jpg";

// Quote overlaid on the photo panel.
const QUOTE = {
  body: "Every guest became a photographer. One QR code, no apps, no sign-ups — and we woke up to every moment of the night in one gallery.",
  title: "Making memories last forever",
};

// ── Shared field / button styles ─────────────────────────────────────────────
export const AUTH_INPUT =
  "w-full rounded-xl bg-white/[0.05] px-4 py-3.5 text-[14px] text-white outline-none ring-1 ring-white/10 placeholder:text-[#8a8a8a] focus:ring-white/30";

export function AuthSubmit({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl py-3.5 text-[15px] font-[700] text-white disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: ACCENT }}
    >
      {children}
    </button>
  );
}

// Password input with the show/hide eye toggle from the mockup.
export function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  minLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        placeholder={placeholder}
        className={`${AUTH_INPUT} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8a8a8a] hover:text-white"
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden>
            <path d="M3 3l18 18M10.6 10.7a2.8 2.8 0 0 0 3.9 4M6.7 6.9C4.5 8.2 2.9 10 2 12c1.8 4 5.5 6.5 10 6.5 1.9 0 3.6-.4 5.1-1.2M9.9 5.7A10.9 10.9 0 0 1 12 5.5c4.5 0 8.2 2.5 10 6.5-.5 1.1-1.2 2.1-2 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden>
            <path d="M2 12c1.8-4 5.5-6.5 10-6.5S20.2 8 22 12c-1.8 4-5.5 6.5-10 6.5S3.8 16 2 12Z" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.8" />
          </svg>
        )}
      </button>
    </div>
  );
}

// "Or login with" divider.
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-white/15" />
      <span className="text-[11px] uppercase tracking-[0.22em] text-[#9a9a9a]">{label}</span>
      <div className="h-px flex-1 bg-white/15" />
    </div>
  );
}

// Google outline button.
export function ProviderButtons({
  onGoogle,
  googleLoading,
}: {
  onGoogle: () => void;
  googleLoading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onGoogle}
      disabled={googleLoading}
      className="w-full rounded-xl py-3 text-[15px] font-[600] text-[#d6d6d6] ring-1 ring-white/15 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {googleLoading ? "Redirecting…" : "Google"}
    </button>
  );
}

export default function AuthShell({
  heading,
  children,
  footer,
}: {
  heading: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* MOBILE — same photo as a dimmed full-screen background, no quote text */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PHOTO}
        alt=""
        className="fixed inset-0 h-full w-full object-cover opacity-[0.54] md:hidden"
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] items-center justify-center px-[15px] py-10 md:items-stretch md:justify-normal md:gap-8 md:px-8 md:py-8 lg:gap-14 lg:px-12">
        {/* DESKTOP — photo panel with the review quote + dots */}
        <div className="relative hidden overflow-hidden rounded-2xl md:block md:w-[55%] lg:w-[58%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {/* Soften the photo, then fade its bottom edge into the dark */}
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-transparent to-black/95" />

          <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
            <p className="font-bebas text-[26px] font-[800] uppercase leading-[1.18] tracking-[0.01em] text-white lg:text-[34px]">
              &ldquo;{QUOTE.body}&rdquo;
            </p>
            <p className="mt-6 text-[16px] font-[800] text-white lg:text-[18px]">{QUOTE.title}</p>
          </div>
        </div>

        {/* Credentials panel — a floating card on mobile, the right column on desktop */}
        <div className="w-full max-w-[420px] rounded-2xl bg-black/70 p-6 backdrop-blur-md md:flex md:w-[45%] md:max-w-none md:flex-1 md:flex-col md:rounded-none md:bg-transparent md:p-0 md:py-4 md:backdrop-blur-none lg:px-10">
          <p className="font-bebas text-[30px] font-[800] uppercase leading-none tracking-[0.01em] text-white md:text-[38px]">
            Gather
          </p>

          <div className="mx-auto mt-8 w-full md:my-auto md:max-w-[420px] md:py-10">
            <h1 className="text-center font-bebas text-[28px] font-[800] uppercase tracking-[0.02em] text-white md:text-[34px]">
              {heading}
            </h1>
            <div className="mt-8">{children}</div>
            <p className="mt-8 text-center text-[13px] text-[#9a9a9a] md:text-[14px]">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
