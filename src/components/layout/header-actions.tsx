"use client";

import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSession } from "@/lib/client/use-session";
import { Button } from "@/components/ui/button";

/** Header actions for mobile: notifications + theme. Desktop sidebar shows profile. */
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-esi-text-secondary hover:text-esi-text-primary hover:bg-surface-2 transition-colors"
          >
            <Icon name="Bell" size={20} />
          </Link>
          <Link
            href="/settings"
            aria-label="حساب کاربری"
            className="h-9 w-9 rounded-full esi-gradient-brand flex items-center justify-center text-primary-foreground text-sm font-bold"
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
