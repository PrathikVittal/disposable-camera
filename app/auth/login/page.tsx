"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell, {
  AUTH_INPUT,
  AuthSubmit,
  OrDivider,
  PasswordInput,
  ProviderButtons,
} from "@/app/auth/AuthShell";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
      } else {
        router.push(callbackUrl);
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
    await signIn("google", { callbackUrl });
  };

  return (
    <AuthShell
      heading="Sign In"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="font-[700] text-white hover:underline">
            Sign Up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
        />

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#9a9a9a]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded accent-[#4F46E5]"
            />
            Remember me
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-[13px] text-[#d6d6d6] underline underline-offset-4 hover:text-white"
          >
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-[13px] font-[600] text-red-400">{error}</p>}

        <div className="pt-2">
          <AuthSubmit disabled={loading}>{loading ? "Signing in…" : "Sign In"}</AuthSubmit>
        </div>
      </form>

      <div className="mt-7 space-y-5">
        <OrDivider label="Or login with" />
        <ProviderButtons onGoogle={handleGoogle} googleLoading={googleLoading} />
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
