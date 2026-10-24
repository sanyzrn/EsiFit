"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar, MobileBottomNav, BrandMark } from "@/components/layout/navigation";
import { MobileHeaderActions } from "@/components/layout/header-actions";
import { SessionProvider } from "@/lib/client/use-session";
import type { ClientSession } from "@/lib/auth/session-types";
import { FeatureFlagProvider } from "@/lib/feature-flags/flag-provider";
import { OfflineIndicator } from "@/components/features/offline-sync-indicator";
import type { FeatureFlag } from "@/lib/feature-flags/registry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Primary member destinations — these do not need a back chip (nav is present). */
const PRIMARY_MEMBER_ROUTES = new Set([
  "/dashboard",
  "/workouts",
  "/nutrition",
  "/analytics",
  "/community",
  "/store",
  "/achievements",
  "/ai",
]);

export type AppShellVariant = "app" | "auth" | "public";

export function AppShell({
  session,
  flags,
  variant = "app",
  children,
}: {
  session: ClientSession | null;
  flags?: Record<FeatureFlag, boolean>;
  /** auth = focused flow (no bottom nav); app = normal member shell. */
  variant?: AppShellVariant;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLiveWorkout = pathname.startsWith("/workout/live");
  const isAuthFlow = variant === "auth" || pathname.startsWith("/auth/");
  const showMemberChrome = Boolean(session) && !isAuthFlow && !isLiveWorkout;
  const showBottomNav = showMemberChrome;
  const showMobileHeader = Boolean(session) && !isAuthFlow;

  // Bottom nav only when it exists — avoid empty reserved padding.
  const mainPadBottom = showBottomNav
    ? "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10"
    : isLiveWorkout
      ? "pb-[calc(4rem+env(safe-area-inset-bottom))]"
      : "pb-10";

  return (
    <FeatureFlagProvider flags={flags}>
      <SessionProvider initial={session}>
        <div className="esi-flat-app relative flex min-h-dvh bg-background">
          {showMemberChrome && <AppSidebar />}
          <div className="flex-1 flex flex-col min-w-0">
            {showMobileHeader && <MobileAppHeader />}
            <main className={cn("flex-1 app-main-content", mainPadBottom)}>
              {children}
            </main>
          </div>
          {session?.role === "member" && <OfflineIndicator />}
        </div>
        {showBottomNav && <MobileBottomNav />}
      </SessionProvider>
    </FeatureFlagProvider>
  );
}

function MobileAppHeader() {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface-1 safe-top lg:hidden">
      <div className="h-14 flex items-center justify-between px-4">
        <BrandMark />
        <MobileHeaderActions onBellClick={() => router.push("/notifications")} />
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  action,
  backHref,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-4 lg:px-8 pt-6 pb-4 max-w-6xl mx-auto w-full",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-esi-text-muted hover:text-esi-text-primary mb-1 transition-colors min-h-11"
          >
            {/* RTL: chevron points toward the start (right) */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="rtl:rotate-180">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            بازگشت
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight leading-snug sm:text-3xl lg:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-esi-text-secondary">{description}</p>}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Secondary member routes get a consistent back affordance when the page
 * did not provide one via PageHeader.backHref.
 */
export function MemberBackBar({ href = "/dashboard", label = "بازگشت" }: { href?: string; label?: string }) {
  return (
    <div className="px-4 lg:px-8 pt-4 max-w-6xl mx-auto w-full">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-esi-text-muted hover:text-esi-text-primary transition-colors min-h-11"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="rtl:rotate-180">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </Link>
    </div>
  );
}

export { Button };
