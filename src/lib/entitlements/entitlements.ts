/**
 * Entitlement model per DATA_MODEL §17.
 * Member-only tiers: free | vip | vip_plus; staff access comes from role.
 * Product logic resolves capabilities here — never string-compare tiers in UI/API.
 * NOTE: client imports of this module get the *display* defaults only;
 * authoritative checks run server-side via getEntitlements(userTier).
 */

import type { MemberTier } from "@/lib/auth/access-policy";
export type UserTier = MemberTier;

export const TIER_LABELS: Record<UserTier, string> = {
  free: "رایگان",
  vip: "وی‌آی‌پی",
  vip_plus: "وی‌آی‌پی پلاس",
};

export type Entitlements = {
  tier: UserTier;
  /** AI assistant messages per rolling day. */
  /** Legacy tier allowance; effective assistant access/limits come from AiGrant. */
  aiMessagesPerDay: number;
  /** Months of workout/nutrition history retained in views. */
  historyMonths: number;
  /** Advanced analytics surfaces (body radar, muscle heat full depth). */
  advancedAnalytics: boolean;
  /** Weekly recap generation. */
  weeklyRecap: boolean;
  /** Export personal data. */
  dataExport: boolean;
  /** Priority AI context (longer system context). */
  aiDeepContext: boolean;
  /** Store discount percent (0–100). */
  storeDiscountPercent: number;
};

const FREE: Entitlements = {
  tier: "free",
  aiMessagesPerDay: 10,
  historyMonths: 3,
  advancedAnalytics: false,
  weeklyRecap: false,
  dataExport: false,
  aiDeepContext: false,
  storeDiscountPercent: 0,
};

const VIP: Entitlements = {
  tier: "vip",
  aiMessagesPerDay: 60,
  historyMonths: 12,
  advancedAnalytics: true,
  weeklyRecap: true,
  dataExport: true,
  aiDeepContext: true,
  storeDiscountPercent: 5,
};

const VIP_PLUS: Entitlements = {
  tier: "vip_plus",
  aiMessagesPerDay: 200,
  historyMonths: 36,
  advancedAnalytics: true,
  weeklyRecap: true,
  dataExport: true,
  aiDeepContext: true,
  storeDiscountPercent: 10,
};

export const ENTITLEMENT_TABLE: Record<UserTier, Entitlements> = {
  free: FREE,
  vip: VIP,
  vip_plus: VIP_PLUS,
};

export function getEntitlements(tier: UserTier): Entitlements {
  return ENTITLEMENT_TABLE[tier] ?? FREE;
}

/** Guard helper for API routes. */
export function hasCapability(tier: UserTier, cap: keyof Omit<Entitlements, "tier">): boolean {
  const value = getEntitlements(tier)[cap];
  return typeof value === "boolean" ? value : value > 0;
}
