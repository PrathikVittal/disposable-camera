import bcrypt from "bcryptjs";
import prisma from "@/lib/db";

const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Web Crypto (global in both Node and the Edge Runtime) — avoids importing the
// Node `crypto` module, which the auth/middleware edge bundle can't load.
function generateSixDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

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
// Password reset codes
// ---------------------------------------------------------------------------

/**
 * Generate a 6-digit reset code for a user, store only its hash (with a short
 * expiry), and return the plaintext code to email. Any prior codes for the user
 * are invalidated so only the newest one works.
 */
export async function createPasswordResetCode(userId: string): Promise<string> {
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);

  await prisma.passwordResetCode.deleteMany({ where: { userId } });
  await prisma.passwordResetCode.create({ data: { userId, codeHash, expiresAt } });
  return code;
}

/**
 * Validate a reset code for a user. Returns true (and marks the code used) only
 * if a matching, unused, unexpired code exists.
 */
export async function consumeResetCode(userId: string, code: string): Promise<boolean> {
  const candidates = await prisma.passwordResetCode.findMany({
    where: { userId, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  for (const candidate of candidates) {
    if (await bcrypt.compare(code, candidate.codeHash)) {
      await prisma.passwordResetCode.update({
        where: { id: candidate.id },
        data: { used: true },
      });
      return true;
    }
  }
  return false;
}

/** Hash and set a new password for a user. */
export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
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
