import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, createHmac } from "crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import type { User } from "@prisma/client";
import { canAccessRole, isRole, isMemberTier, type AccessScope } from "@/lib/auth/access-policy";

/**
 * First-party session layer.
 * - Opaque session token stored hashed (sha256) in DB; raw token lives in an
 *   httpOnly, SameSite=Lax cookie. Server-side revocable.
 * - A JWT wrapper binds the raw token to prevent tampering and enables
 *   stateless fast-path verification before a DB hit.
 */

const COOKIE_NAME = "esifit_session";
const SESSION_TTL_DAYS = 30;

/** Sandbox-only signing key. Never reachable in production (see secretKey). */
export const DEV_SESSION_SECRET = "esifit-dev-secret-do-not-use-in-production-0123456789";

/**
 * The single server signing secret. Every consumer (session JWTs, OTP hashes)
 * resolves it here so a misconfigured deployment fails the same way everywhere.
 */
export function serverSecret(): string {
  const secret = process.env.SESSION_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    // Fail closed: a public build signed with a published constant would let
    // anyone mint a valid session cookie.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[esifit] FATAL: SESSION_SECRET (or AUTH_SECRET) is not set. Refusing to sign or verify sessions with the built-in development secret — anyone could forge a session cookie. Set it and restart.",
      );
      throw new AppError("unexpected", {
        userMessage: "پیکربندی سرور ناقص است. لطفاً بعداً تلاش کنید.",
        cause: new Error("SESSION_SECRET is not set"),
      });
    }
    return DEV_SESSION_SECRET;
  }
  return secret;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(serverSecret());
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

  const tokenHash = hashToken(raw);
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    // The JWT binds this specific opaque token: a validly signed wrapper from
    // another session must not authenticate a token it was not issued for.
    if (payload.sid !== tokenHash) return null;
  } catch {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.revokedAt || session.user.status !== "active" || !isRole(session.user.role)) return null;

  // Touch last seen at most every 5 minutes — a write on every page/API hit is
  // wasted load (and the device list only needs minute-level freshness).
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    void db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  const tier = session.user.role === "member"
    ? await resolveEffectiveTier(session.user.id, session.user.tier)
    : "free"; // Staff tier is a neutral storage placeholder, not a subscription.
  return toSessionUser({ ...session.user, tier }, Boolean(session.user.profile?.onboardedAt));
}

/**
 * Paid tiers require a non-expired subscription. Seed/demo accounts without any
 * subscription row keep their assigned tier. Expired paid subscriptions downgrade.
 */
async function resolveEffectiveTier(userId: string, storedTier: string): Promise<string> {
  const safeTier = isMemberTier(storedTier) ? storedTier : "free";
  if (safeTier === "free") return safeTier;
  const subs = await db.subscription.findMany({
    where: { userId },
    orderBy: { currentPeriodEndsAt: "desc" },
    select: { tier: true, status: true, currentPeriodEndsAt: true },
  });
  if (subs.length === 0) return safeTier; // seeded / admin-assigned tier
  const now = new Date();
  const active = subs.find((s) => s.status === "active" && s.currentPeriodEndsAt >= now);
  if (active && isMemberTier(active.tier)) return active.tier;
  // A purchase/cancellation may have committed since the first subscription
  // read. Recheck under the same member-row lock used by those writes so an
  // expired snapshot cannot overwrite a newly purchased entitlement.
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const current = await tx.subscription.findFirst({
      where: { userId, status: "active", currentPeriodEndsAt: { gte: new Date() } },
      orderBy: { currentPeriodEndsAt: "desc" }, select: { tier: true },
    });
    if (current && isMemberTier(current.tier)) return current.tier;
    await tx.user.update({ where: { id: userId }, data: { tier: "free" } });
    return "free";
  });
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

/** Exact role authorization: admin does NOT implicitly become a coach/member. */
export async function requireRole(...allowed: AccessScope[]): Promise<SessionUser & { role: Role }> {
  const user = await requireUser();
  if (!allowed.some((scope) => canAccessRole(user.role, scope))) {
    throw new AppError("authorization", {
      userMessage: "این عملیات برای نقش حساب شما مجاز نیست.",
    });
  }
  return { ...user, role: user.role };
}

/** Every personal fitness API must be member-only, not just authenticated. */
export async function requireMember(): Promise<SessionUser & { role: "member" }> {
  const user = await requireRole("member");
  return { ...user, role: "member" };
}

/** Only coach or admin may read supervisory information; writes use exact role. */
export function isCoachLike(role: string): boolean {
  return canAccessRole(role, "coach_or_admin");
}

/** List active sessions for the current user (settings → devices). */
export async function listSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true },
  });
}
