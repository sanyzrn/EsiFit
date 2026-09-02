import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, createHmac } from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import type { User } from "@prisma/client";

/**
 * First-party session layer.
 * - Opaque session token stored hashed (sha256) in DB; raw token lives in an
 *   httpOnly, SameSite=Lax cookie. Server-side revocable.
 * - A JWT wrapper binds the raw token to prevent tampering and enables
 *   stateless fast-path verification before a DB hit.
 */

const COOKIE_NAME = "esifit_session";
const SESSION_TTL_DAYS = 30;

function secretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    // Sandbox fallback; production deployments MUST set SESSION_SECRET.
    "esifit-dev-secret-do-not-use-in-production-0123456789";
  if (!process.env.SESSION_SECRET && !process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
    console.warn("[esifit] SESSION_SECRET is not set — using the built-in development secret. Sessions are NOT secure in this state.");
  }
  return new TextEncoder().encode(secret);
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function hmac(value: string): string {
  return createHmac("sha256", secretKey()).update(value).digest("hex");
}

export type SessionUser = {
  id: string;
  phone: string;
  displayName: string;
  role: Role;
  tier: string;
  timezone: string;
  unitSystem: string;
  onboarded: boolean;
};

function toSessionUser(user: User, onboarded: boolean): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role as Role,
    tier: user.tier,
    timezone: user.timezone,
    unitSystem: user.unitSystem,
    onboarded,
  };
}

export async function createSession(userId: string, deviceLabel: string): Promise<void> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await db.session.create({
    data: { userId, tokenHash, deviceLabel: deviceLabel.slice(0, 120) },
  });

  const jwt = await new SignJWT({ sid: tokenHash })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, `${raw}.${jwt}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const cookieValue = store.get(COOKIE_NAME)?.value;
  if (cookieValue) {
    const [raw] = cookieValue.split(".");
    if (raw) {
      await db.session.updateMany({
        where: { tokenHash: hashToken(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  store.delete(COOKIE_NAME);
}

/** Returns the authenticated user or null. Fast-path validates JWT then hits DB. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieValue = store.get(COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  const dot = cookieValue.indexOf(".");
  if (dot < 0) return null;
  const [raw, jwt] = [cookieValue.slice(0, dot), cookieValue.slice(dot + 1)];

  try {
    await jwtVerify(jwt, secretKey());
  } catch {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.revokedAt || session.user.status !== "active") return null;

  // Touch last seen (fire and forget; not awaited in callers).
  void db.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return toSessionUser(session.user, Boolean(session.user.profile?.onboardedAt));
}

/** Route-guard: throws authentication AppError when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("authentication");
  return user;
}

/** Application roles — permission axis (orthogonal to the monetization `tier`). */
export type { Role, ROLE_LABELS } from "@/lib/auth/session-types";
import type { Role } from "@/lib/auth/session-types";

/**
 * Route-guard for privileged APIs. Admin may act anywhere; coach is limited to
 * coach scopes. Throws authentication (401) or authorization (403) AppError.
 * Admin is always a superset — a single guard covers both staff surfaces.
 */
export async function requireRole(
  ...allowed: Array<Role | "coach_or_admin">
): Promise<SessionUser & { role: Role }> {
  const user = await requireUser();
  const role = user.role as Role;

  // Admin is the supervisor role and passes every staff gate.
  if (role === "admin") return { ...user, role };

  if (allowed.includes("coach_or_admin")) {
    if (role === "coach") return { ...user, role };
    throw new AppError("authorization", { userMessage: "این بخش برای مربیان و مدیران است." });
  }
  if (!allowed.includes(role)) {
    throw new AppError("authorization", { userMessage: "شما به این بخش دسترسی ندارید." });
  }
  return { ...user, role };
}

/** True when the session may access coach surfaces. */
export function isCoachLike(role: string): boolean {
  return role === "coach" || role === "admin";
}


/** List active sessions for the current user (settings → devices). */
export async function listSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true },
  });
}
