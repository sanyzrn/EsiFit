import { describe, it, expect } from "vitest";
import {
  canAccessRole, isMemberTier, isRole, storedTierForRole, visibleMemberTier,
} from "@/lib/auth/access-policy";
import { getEntitlements } from "@/lib/entitlements/entitlements";

describe("exclusive account roles and commercial membership", () => {
  it("rejects unknown roles and never grants staff access to member actions", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("coach")).toBe(true);
    expect(isRole("member")).toBe(true);
    expect(isRole("vip_plus")).toBe(false);
    expect(canAccessRole("admin", "member")).toBe(false);
    expect(canAccessRole("coach", "member")).toBe(false);
    expect(canAccessRole("admin", "coach")).toBe(false);
    expect(canAccessRole("coach", "admin")).toBe(false);
    expect(canAccessRole("member", "coach")).toBe(false);
    expect(canAccessRole("member", "admin")).toBe(false);
    expect(canAccessRole("admin", "coach_or_admin")).toBe(true);
    expect(canAccessRole("coach", "coach_or_admin")).toBe(true);
    expect(canAccessRole("member", "coach_or_admin")).toBe(false);
    expect(canAccessRole("root", "admin")).toBe(false);
    expect(canAccessRole(null, "member")).toBe(false);
  });

  it("treats Free, VIP and VIP Plus as member features, not staff privileges", () => {
    expect(isMemberTier("free")).toBe(true);
    expect(isMemberTier("vip")).toBe(true);
    expect(isMemberTier("vip_plus")).toBe(true);
    expect(isMemberTier("coach")).toBe(false);
    expect(visibleMemberTier("member", "vip_plus")).toBe("vip_plus");
    expect(visibleMemberTier("coach", "vip_plus")).toBeNull();
    expect(visibleMemberTier("admin", "vip")).toBeNull();
    expect(visibleMemberTier("member", "coach")).toBe("free");
    expect(storedTierForRole("coach", "vip_plus")).toBe("free");
    expect(storedTierForRole("admin", "vip")).toBe("free");
    expect(storedTierForRole("member", "vip")).toBe("vip");
    expect(getEntitlements("vip_plus").aiMessagesPerDay).toBeGreaterThan(getEntitlements("vip").aiMessagesPerDay);
  });
});
