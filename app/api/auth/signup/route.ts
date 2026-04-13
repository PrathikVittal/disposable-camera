import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createUserWithPassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, name, password } = body ?? {};

  if (!email || !name || !password) {
    return NextResponse.json(
      { error: "Email, name, and password are required." },
      { status: 400 },
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const user = await createUserWithPassword(email, name, password);

  return NextResponse.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { status: 201 },
  );
}
