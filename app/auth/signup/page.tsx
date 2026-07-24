"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell, {
  AUTH_INPUT,
  AuthSubmit,
  OrDivider,
  PasswordInput,
  ProviderButtons,
} from "@/app/auth/AuthShell";

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
    <AuthShell
      heading="Sign Up"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-[700] text-white hover:underline">
            Sign In
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
          placeholder="Name"
          className={AUTH_INPUT}
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
          placeholder="Email"
          className={AUTH_INPUT}
        />
        <PasswordInput
          value={form.password}
          onChange={(v) => setForm((p) => ({ ...p, password: v }))}
          placeholder="Password (at least 8 characters)"
          minLength={8}
        />
        <PasswordInput
          value={form.confirm}
          onChange={(v) => setForm((p) => ({ ...p, confirm: v }))}
          placeholder="Confirm password"
        />

        {error && <p className="text-[13px] font-[600] text-red-400">{error}</p>}

        <div className="pt-2">
          <AuthSubmit disabled={loading}>
            {loading ? "Creating account…" : "Sign Up"}
          </AuthSubmit>
        </div>
      </form>

      <div className="mt-7 space-y-5">
        <OrDivider label="Or sign up with" />
        <ProviderButtons onGoogle={handleGoogle} googleLoading={googleLoading} />
      </div>
    </AuthShell>
  );
}
