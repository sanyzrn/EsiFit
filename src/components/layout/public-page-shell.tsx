"use client";

import * as React from "react";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { SessionProvider } from "@/lib/client/use-session";
import { FeatureFlagProvider } from "@/lib/feature-flags/flag-provider";
import type { ClientSession } from "@/lib/auth/session-types";
import type { FeatureFlag } from "@/lib/feature-flags/registry";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for public/marketing routes.
 * - Anonymous: fixed PublicNavbar + top padding that clears the header + Footer.
 * - Signed-in: member AppShell only (no stacked PublicNavbar — avoids z-index
 *   double-header) + optional compact back via PageHeader from the page.
 */
export function PublicPageShell({
  session,
  flags,
  title,
  description,
  backHref,
  showFooter = true,
  children,
  className,
}: {
  session: ClientSession | null;
  flags?: Record<FeatureFlag, boolean>;
  title?: string;
  description?: string;
  backHref?: string;
  /** Footer on anonymous marketing surfaces; usually false for member-in-app views. */
  showFooter?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (session) {
    return (
      <AppShell session={session} flags={flags} variant="app">
        {title ? (
          <PageHeader title={title} description={description} backHref={backHref ?? "/dashboard"} />
        ) : null}
        <div className={cn("pb-6", className)}>{children}</div>
        {showFooter ? <Footer /> : null}
      </AppShell>
    );
  }

  return (
    <FeatureFlagProvider flags={flags}>
      <SessionProvider initial={null}>
        <div className="min-h-dvh flex flex-col">
          <PublicNavbar />
          {/* Clears fixed h-16 navbar + safe-area; never overlap PageHeader. */}
          <main className={cn("flex-1 pt-24 lg:pt-28 public-shell-main", className)}>
            {title ? <PageHeader title={title} description={description} backHref={backHref} /> : null}
            {children}
          </main>
          {showFooter ? <Footer /> : null}
        </div>
      </SessionProvider>
    </FeatureFlagProvider>
  );
}
