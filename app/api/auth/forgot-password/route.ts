import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetCode } from "@/lib/users";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await getUserByEmail(email);

  // Only credentials accounts have a password to reset (Google accounts don't).
  // We email a code when applicable but ALWAYS return the same response so we
  // never reveal whether an email is registered.
  if (user && user.provider === "credentials" && user.passwordHash) {
    try {
      const code = await createPasswordResetCode(user.id);
      await sendPasswordResetEmail(user.email, code);
    } catch (err) {
      // Log server-side but don't surface — avoids leaking account existence.
      console.error("[forgot-password] failed to send reset code:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
