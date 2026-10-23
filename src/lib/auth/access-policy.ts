import type { Role } from "@/lib/auth/session-types";

/**
 * App authorization is role-based; membership is a separate commercial axis.
 * Backend uses this exact policy on EVERY protected action (not just the nav).
 * "coach_or_admin" is for deliberate read-only supervisory APIs only.
 */
export const ROLES = ["member", "coach", "admin"] as const;
export const MEMBER_TIERS = ["free", "vip", "vip_plus"] as const;
export type MemberTier = (typeof MEMBER_TIERS)[number];
export type AccessScope = Role | "coach_or_admin";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isMemberTier(value: unknown): value is MemberTier {
  return typeof value === "string" && (MEMBER_TIERS as readonly string[]).includes(value);
}

export function canAccessRole(role: unknown, scope: AccessScope): boolean {
  if (!isRole(role)) return false;
  return scope === "coach_or_admin"
    ? role === "coach" || role === "admin"
    : role === scope;
}

/** Staff roles cannot acquire paid-athlete benefits via a stale DB tier. */
export function visibleMemberTier(role: unknown, tier: unknown): MemberTier | null {
  return role === "member" && isMemberTier(tier) ? tier : role === "member" ? "free" : null;
}

/** The User.tier string is currently NOT nullable in Prisma. Staff persist a
 * neutral 'free' placeholder, which is never displayed as a staff subscription.
 * A future migration may make it nullable after payment/billing data is audited.
 */
export function storedTierForRole(role: Role, tier: MemberTier = "free"): MemberTier {
  return role === "member" ? tier : "free";
}
