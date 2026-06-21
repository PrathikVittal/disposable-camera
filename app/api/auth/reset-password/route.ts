import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, consumeResetCode, updateUserPassword } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !code || !password) {
    return NextResponse.json(
      { error: "Email, code, and new password are required." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const user = await getUserByEmail(email);
  // Generic error so we don't reveal whether the email/account exists.
  if (!user || user.provider !== "credentials") {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  const valid = await consumeResetCode(user.id, code);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  await updateUserPassword(user.id, password);
  return NextResponse.json({ ok: true });
}
