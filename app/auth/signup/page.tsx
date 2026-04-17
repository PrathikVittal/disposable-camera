"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Overline from "@/app/components/Overline";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to create account.");
        return;
      }
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) {
        router.push("/auth/login");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-[15px]">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-[22px] font-[800] tracking-[-0.02em]">Create an account</h1>
          <p className="text-[10px] text-[#888]">Start hosting events in minutes</p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-[6px] border-[1.5px] border-black bg-white px-4 py-[10px] text-[10px] font-[700] tracking-[0.08em] uppercase text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {googleLoading ? "Redirecting…" : "Sign up with Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E0E0E0]" />
          <span className="text-[9px] text-[#888]">or</span>
          <div className="h-px flex-1 bg-[#E0E0E0]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Overline>Name</Overline>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              placeholder="Your name"
              className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
            />
          </div>
          <div className="space-y-1">
            <Overline>Email</Overline>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              placeholder="you@example.com"
              className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
            />
          </div>
          <div className="space-y-1">
            <Overline>Password</Overline>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
            />
          </div>
          <div className="space-y-1">
            <Overline>Confirm password</Overline>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
              required
              placeholder="Repeat your password"
              className="w-full rounded-[6px] border border-[#E0E0E0] bg-[#F5F5F5] px-[10px] py-2 text-[10px] text-black outline-none placeholder:text-[#888] focus:border-black focus:bg-white"
            />
          </div>

          {error && (
            <p className="text-[10px] font-[600] text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[6px] bg-black text-white px-4 py-[11px] text-[10px] font-[800] tracking-[0.08em] uppercase disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-[10px] text-[#888]">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-black underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
