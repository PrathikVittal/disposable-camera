import bcrypt from "bcryptjs";
import prisma from "@/lib/db";

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  provider: "credentials" | "google";
  createdAt: string;
};

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const row = await prisma.user.findUnique({ where: { email } });
  return row ? toUser(row) : undefined;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toUser(row) : undefined;
}

export async function createUserWithPassword(
  email: string,
  name: string,
  password: string,
): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 12);
  const row = await prisma.user.create({
    data: { email, name, passwordHash, provider: "credentials" },
  });
  return toUser(row);
}

export function createOAuthUser(email: string, name: string): Promise<User> {
  return prisma.user
    .upsert({
      where: { email },
      create: { email, name, provider: "google" },
      update: { name },
    })
    .then(toUser);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

// ---------------------------------------------------------------------------

function toUser(row: {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  provider: string;
  createdAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash ?? undefined,
    provider: row.provider as "credentials" | "google",
    createdAt: row.createdAt.toISOString(),
  };
}
