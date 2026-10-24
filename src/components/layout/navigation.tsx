"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useSession } from "@/lib/client/use-session";
import { useFlags } from "@/lib/feature-flags/flag-provider";
import type { FeatureFlag } from "@/lib/feature-flags/registry";
import { TIER_LABELS, type UserTier } from "@/lib/entitlements/entitlements";
import { ROLE_LABELS, type Role } from "@/lib/auth/session-types";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { KhatamMark } from "@/components/motion/khatam";

/** One source of navigation truth. Role gates are enforced at the API as well. */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  flag?: FeatureFlag;
  mobile?: boolean;
};

export const MEMBER_NAV: NavItem[] = [
  { href: "/dashboard", label: "خانه", icon: "LayoutDashboard", flag: "DASHBOARD", mobile: true },
  { href: "/workouts", label: "تمرین", icon: "Dumbbell", flag: "WORKOUTS", mobile: true },
  { href: "/nutrition", label: "تغذیه", icon: "Apple", flag: "NUTRITION", mobile: true },
  { href: "/analytics", label: "پیشرفت", icon: "ChartLine", flag: "ANALYTICS" },
  { href: "/achievements", label: "دستاوردها", icon: "Trophy", flag: "GAMIFICATION" },
  { href: "/community", label: "انجمن", icon: "Users", flag: "COMMUNITY", mobile: true },
  { href: "/store", label: "فروشگاه", icon: "ShoppingBag", flag: "SHOP" },
  { href: "/ai", label: "دستیار هوشمند", icon: "Sparkles", flag: "AI_CHAT" },
  { href: "/notifications", label: "اعلان‌ها", icon: "Bell", flag: "NOTIFICATIONS" },
  { href: "/settings", label: "حساب من", icon: "User" },
];

export const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "ورزشکاران", icon: "ClipboardList", mobile: true },
  { href: "/notifications", label: "اعلان‌ها", icon: "Bell", mobile: true },
  { href: "/settings", label: "حساب من", icon: "User", mobile: true },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "مدیریت", icon: "Shield", mobile: true },
  { href: "/notifications", label: "اعلان‌ها", icon: "Bell", mobile: true },
  { href: "/settings", label: "حساب من", icon: "User", mobile: true },
];

export const STAFF_NAV: Record<"coach" | "admin", NavItem[]> = {
  coach: [],
  admin: [],
};

export function useMemberNav(): NavItem[] {
  const flags = useFlags();
  const session = useSession();
  const model = session?.role === "admin" ? ADMIN_NAV : session?.role === "coach" ? COACH_NAV : MEMBER_NAV;
  return model.filter((item) => !item.flag || flags[item.flag]);
}

export function useStaffNav(): { role: "coach" | "admin"; items: NavItem[] } | null {
  const session = useSession();
  const flags = useFlags();
  const role = session?.role as Role | undefined;
  if (role !== "coach" && role !== "admin") return null;
  const items = STAFF_NAV[role].filter((item) => !item.flag || flags[item.flag]);
  return items.length ? { role, items } : null;
}

function isCurrentPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl border-s-2 border-transparent px-3 text-sm transition-colors duration-150",
        active
          ? "border-s-primary bg-surface-2 font-semibold text-esi-text-primary"
          : "text-esi-text-secondary hover:bg-surface-2 hover:text-esi-text-primary",
      )}
    >
      <Icon name={item.icon} size={20} strokeWidth={1.75} className={active ? "text-primary" : undefined} />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const session = useSession();
  const nav = useMemberNav();

  return (
    <aside className={cn("sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-s border-border bg-sidebar lg:flex", className)}>
      <div className="flex h-20 shrink-0 items-center border-b border-border px-5">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="ناوبری اصلی">
        <p className="mb-3 px-3 text-xs font-semibold text-esi-text-muted">فضای شما</p>
        {nav.map((item) => (
          <NavLink key={item.href} item={item} active={isCurrentPath(pathname, item.href)} />
        ))}
      </nav>
      {session && (
        <Link href="/settings" className="flex min-h-20 items-center gap-3 border-t border-border px-5 transition-colors hover:bg-surface-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-bold text-esi-text-primary">
            {session.displayName.trim()[0] ?? "؟"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{session.displayName}</span>
            <span className="mt-1 block text-xs text-esi-text-muted">
              {session.role === "member" ? TIER_LABELS[session.tier as UserTier] ?? "رایگان" : ROLE_LABELS[session.role]}
            </span>
          </span>
          <Icon name="ChevronLeft" size={16} className="text-esi-text-muted" />
        </Link>
      )}
    </aside>
  );
}

/** Edge-to-edge mobile tab bar: flat surfaces, no dock, shadow or glow. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const nav = useMemberNav();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const items = nav.filter((item) => item.mobile);
  const extraItems = nav.filter((item) => !item.mobile);
  const extraActive = extraItems.some((item) => isCurrentPath(pathname, item.href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-1 lg:hidden"
      aria-label="ناوبری موبایل"
    >
      <div className="mx-auto grid h-[68px] max-w-xl items-stretch px-2" style={{ gridTemplateColumns: `repeat(${items.length + (extraItems.length ? 1 : 0) || 1}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] leading-tight transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary active:bg-surface-2",
                active ? "font-bold text-primary" : "font-medium text-esi-text-secondary hover:text-esi-text-primary",
              )}
            >
              <span className={cn(
                "flex h-8 w-12 items-center justify-center rounded-xl transition-colors duration-150",
                active ? "bg-primary/12" : "bg-transparent",
              )}>
                <Icon name={item.icon} size={21} strokeWidth={active ? 2 : 1.75} />
              </span>
              <span className="max-w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
        {extraItems.length > 0 && (
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button type="button" aria-label="بیشتر؛ همه بخش‌ها" className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] focus-visible:outline-2 focus-visible:outline-primary",
                extraActive ? "font-bold text-primary" : "text-esi-text-secondary",
              )}>
                <span className={cn("flex h-8 w-12 items-center justify-center rounded-xl", extraActive && "bg-primary/12")}><Icon name="Menu" size={21} /></span>
                بیشتر
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <SheetHeader className="px-6 pt-6 text-start">
                <SheetTitle>همه بخش‌های اسی‌فیت</SheetTitle>
                <SheetDescription>پیشرفت، دستاوردها و بقیه ابزارهای مسیرت</SheetDescription>
              </SheetHeader>
              <div className="grid gap-1 px-4 sm:grid-cols-2">
                {extraItems.map((item) => <NavLink key={item.href} item={item} active={isCurrentPath(pathname, item.href)} onClick={() => setMoreOpen(false)} />)}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
      <div className="h-[env(safe-area-inset-bottom,0px)]" aria-hidden />
    </nav>
  );
}

/** Branding preserved while motion effects are removed from app chrome. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="اسی‌فیت — صفحه اصلی">
      <KhatamMark size={34} />
      {!compact && <span className="pt-1 font-display text-2xl leading-none">اسی<span className="text-primary">‌فیت</span></span>}
    </Link>
  );
}
