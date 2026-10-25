"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useSession } from "@/lib/client/use-session";
import { Button } from "@/components/ui/button";

/** Header actions for mobile: notifications and account. Theme selection is available. */
export function MobileHeaderActions({ onBellClick }: { onBellClick?: () => void }) {
  const session = useSession();
  return (
    <div className="flex items-center gap-1.5">
      <ThemeToggle />
      {session ? (
        <>
          <Link
            href="/notifications"
            aria-label="اعلان‌ها"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-esi-text-secondary hover:bg-surface-2 hover:text-esi-text-primary transition-colors"
          >
            <Icon name="Bell" size={20} />
          </Link>
          <Link
            href="/settings"
            aria-label="حساب کاربری"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-sm font-bold text-esi-text-primary"
          >
            {session.displayName.trim()[0] ?? "؟"}
          </Link>
        </>
      ) : (
        <Button asChild size="sm" className="h-9">
          <Link href="/auth/login">ورود</Link>
        </Button>
      )}
    </div>
  );
}
