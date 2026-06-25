"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Overline from "@/app/components/Overline";

type Step = "request" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Something went wrong. Please try again.");
      }
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Could not reset your password.");
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-[15px]">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-[22px] font-[800] tracking-[-0.02em]">
            {step === "done" ? "Password updated" : "Reset your password"}
          </h1>
          <p className="text-[10px] text-[#888]">
            {step === "request" && "Enter your email and we'll send you a reset code."}
            {step === "reset" && `Enter the 6-digit code we sent to ${email} and a new password.`}
            {step === "done" && "You can now sign in with your new password."}
          </p>
        </div>

        {step === "request" && (
          <form onSubmit={requestCode} className="space-y-3">
            <div className="space-y-1">
              <Overline>Email</Overline>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
              />
            </div>
            {error && <p className="text-[10px] font-[600] text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[6px] bg-black text-white px-4 py-[11px] text-[10px] font-[800] tracking-[0.08em] uppercase disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={resetPassword} className="space-y-3">
            <div className="space-y-1">
              <Overline>Reset code</Overline>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                placeholder="6-digit code"
                className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[14px] tracking-[0.3em] text-black outline-none placeholder:text-[10px] placeholder:tracking-normal placeholder:text-[#888] focus:border-black focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <Overline>New password</Overline>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
                className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
              />
            </div>
            {error && <p className="text-[10px] font-[600] text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[6px] bg-black text-white px-4 py-[11px] text-[10px] font-[800] tracking-[0.08em] uppercase disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Updating…" : "Set new password"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("request"); setError(null); setCode(""); }}
              className="w-full text-center text-[10px] text-[#888] underline underline-offset-4"
            >
              Use a different email
            </button>
          </form>
        )}

        {step === "done" && (
          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="w-full rounded-[6px] bg-black text-white px-4 py-[11px] text-[10px] font-[800] tracking-[0.08em] uppercase"
          >
            Back to sign in
          </button>
        )}

        {step !== "done" && (
          <p className="text-center text-[10px] text-[#888]">
            Remembered it?{" "}
            <Link href="/auth/login" className="text-black underline underline-offset-4">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
