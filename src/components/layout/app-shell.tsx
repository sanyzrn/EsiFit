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

/**
 * DashboardShell — member app shell with desktop sidebar + mobile bottom nav.
 * Sticky actions never cover safe areas (DESIGN_BIBLE PWA rules).
 */
export function AppShell({
  session,
  flags,
  children,
}: {
  session: ClientSession | null;
  flags?: Record<FeatureFlag, boolean>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLiveWorkout = pathname.startsWith("/workout/live");
  return (
    <FeatureFlagProvider flags={flags}>
      <SessionProvider initial={session}>
        <div className="min-h-dvh flex">
          {session && <AppSidebar />}
          <div className="flex-1 flex flex-col min-w-0">
            {session && <MobileAppHeader />}
            <main
              className={cn(
                "flex-1 pb-24 lg:pb-10",
                isLiveWorkout && "pb-[calc(4rem+env(safe-area-inset-bottom))]",
              )}
            >
              {children}
            </main>
          </div>
          <OfflineIndicator />
        </div>
        {session && !isLiveWorkout && <MobileBottomNav />}
      </SessionProvider>
    </FeatureFlagProvider>
  );
}

function MobileAppHeader() {
  const router = useRouter();
  return (
    <header className="lg:hidden sticky top-0 z-30 h-14 esi-glass border-b border-border safe-top">
      <div className="h-14 flex items-center justify-between px-4">
        <BrandMark />
        <MobileHeaderActions
          onBellClick={() => router.push("/notifications")}
        />
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
    <div className={cn("flex items-start justify-between gap-4 px-4 lg:px-8 pt-6 pb-4 max-w-6xl mx-auto w-full", className)}>
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-esi-text-muted hover:text-esi-text-primary mb-1 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="rotate-180">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            بازگشت
          </Link>
        )}
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-esi-text-secondary mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { Button };
