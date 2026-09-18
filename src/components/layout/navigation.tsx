"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { useSession } from "@/lib/client/use-session";
import { useFlags } from "@/lib/feature-flags/flag-provider";
import type { FeatureFlag } from "@/lib/feature-flags/registry";
import { TIER_LABELS, type UserTier } from "@/lib/entitlements/entitlements";
import { ROLE_LABELS, type Role } from "@/lib/auth/session-types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Shared navigation model — single source for sidebar + bottom nav.
 * Each entry declares its feature flag; disabled entries are hidden.
 * Staff roles (coach/admin) get an extra section — permission axis, not tier.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  flag?: FeatureFlag;
  mobile?: boolean; // show in bottom nav (max 5)
};

export const MEMBER_NAV: NavItem[] = [
  { href: "/dashboard", label: "داشبورد", icon: "LayoutDashboard", flag: "DASHBOARD", mobile: true },
  { href: "/workouts", label: "تمرین", icon: "Dumbbell", flag: "WORKOUTS", mobile: true },
  { href: "/nutrition", label: "تغذیه", icon: "Apple", flag: "NUTRITION", mobile: true },
  { href: "/analytics", label: "پیشرفت", icon: "ChartLine", flag: "ANALYTICS", mobile: true },
  { href: "/achievements", label: "دستاوردها", icon: "Trophy", flag: "GAMIFICATION" },
  { href: "/community", label: "انجمن", icon: "Users", flag: "COMMUNITY" },
  { href: "/store", label: "فروشگاه", icon: "ShoppingBag", flag: "SHOP" },
  { href: "/ai", label: "دستیار هوشمند", icon: "Sparkles", flag: "AI_CHAT" },
  { href: "/notifications", label: "اعلان‌ها", icon: "Bell", flag: "NOTIFICATIONS" },
  { href: "/settings", label: "تنظیمات", icon: "Settings" },
];

export const STAFF_NAV: Record<"coach" | "admin", NavItem[]> = {
  coach: [
    { href: "/coach", label: "ورزشکاران من", icon: "ClipboardList" },
  ],
  admin: [
    { href: "/coach", label: "ورزشکاران من", icon: "ClipboardList" },
    { href: "/admin", label: "کنسول مدیریت", icon: "Shield" },
  ],
};

export function useMemberNav(): NavItem[] {
  const flags = useFlags();
  return MEMBER_NAV.filter((item) => !item.flag || flags[item.flag]);
}

/** Staff section for the current session role (admin sees both). */
export function useStaffNav(): { role: "coach" | "admin"; items: NavItem[] } | null {
  const session = useSession();
  const flags = useFlags();
  const role = session?.role as Role | undefined;
  if (role !== "coach" && role !== "admin") return null;
  const items = STAFF_NAV[role].filter((item) => !item.flag || flags[item.flag]);
  return items.length > 0 ? { role, items } : null;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
        active
          ? "text-esi-text-primary font-semibold"
          : "text-esi-text-secondary hover:text-esi-text-primary hover:bg-surface-2",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active-pill"
          className="absolute inset-0 rounded-lg bg-surface-3"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          aria-hidden
        />
      )}
      <Icon name={item.icon} size={20} className={cn("relative z-10", active && "text-primary")} />
      <span className="relative z-10">{item.label}</span>
      {active && <span className="relative z-10 ms-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
    </Link>
  );
}

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const session = useSession();
  const nav = useMemberNav();
  const staff = useStaffNav();

  return (
    <aside className={cn("hidden lg:flex flex-col h-dvh sticky top-0 w-64 border-s border-border bg-sidebar", className)}>
      <div className="flex items-center gap-2.5 px-6 h-16 shrink-0">
        <BrandMark />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="ناوبری اصلی">
        {nav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}

        {staff && (
          <>
            <div className="pt-4 pb-1 px-3 flex items-center gap-2" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold tracking-wide text-esi-text-muted">
                {roleSectionTitleFa(staff.role)}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {staff.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            ))}
          </>
        )}
      </nav>
      {session && (
        <div className="border-t border-border p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full esi-gradient-brand flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
            {session.displayName.trim()[0] ?? "؟"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{session.displayName}</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="tier" className="text-[10px] px-1.5 py-0">
                {TIER_LABELS[session.tier as UserTier] ?? "عضو"}
              </Badge>
              {(session.role === "coach" || session.role === "admin") && (
                <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                  {ROLE_LABELS[session.role]}
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const session = useSession();
  const nav = useMemberNav().filter((i) => i.mobile);
  const staff = useStaffNav();

  // Athlete essentials (4) + one extra slot: staff workspace when present,
  // otherwise the first nav item not already shown (never a duplicate).
  const items = React.useMemo(() => {
    const base = nav.slice(0, 4);
    const extra = staff && session ? staff.items[0] : nav.find((i) => !base.includes(i));
    return extra ? [...base, extra] : base;
  }, [nav, staff, session]);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 esi-glass border-t border-border safe-bottom"
      aria-label="ناوبری موبایل"
    >
      <div className="grid grid-cols-5 h-16">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 text-[10px] min-h-[44px] transition-colors",
                active ? "text-primary font-semibold" : "text-esi-text-muted",
              )}
            >
              {active && (
                <motion.span
                  layoutId="esifit-bottom-nav-pill"
                  className="absolute inset-x-2 top-1 h-8 rounded-2xl bg-primary/12"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden
                />
              )}
              <Icon name={item.icon} size={22} strokeWidth={active ? 2 : 1.75} className="relative" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function roleSectionTitleFa(role: "coach" | "admin"): string {
  return role === "coach" ? "مربی‌گری" : "مدیریت";
}

/** Brand mark — wordmark + geometric dumbbell glyph. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="اسی‌فیت — صفحه اصلی">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl esi-gradient-brand shadow-[var(--shadow-rest)] transition-transform duration-150 group-hover:scale-105">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8" stroke="var(--primary-foreground)" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight">
          اسی<span className="esi-gradient-brand-text">‌فیت</span>
        </span>
      )}
    </Link>
  );
}
