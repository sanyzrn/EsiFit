"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/client/use-session";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/calculators", label: "ماشین‌حساب‌ها" },
  { href: "/blog", label: "مجله" },
  { href: "/plans", label: "اشتراک" },
  { href: "/store", label: "فروشگاه" },
];

export function PublicNavbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const session = useSession();

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-40 safe-top",
        scrolled || open ? "bg-surface-1 border-b border-border" : "bg-transparent",
      )}
    >
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-1" aria-label="ناوبری عمومی">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-esi-text-secondary transition-colors hover:bg-surface-2 hover:text-esi-text-primary"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session ? (
              <Button asChild size="sm" className="h-10">
                <Link href="/dashboard">داشبورد</Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="hidden sm:inline-flex h-10">
                <Link href="/auth/login">ورود / ثبت‌نام</Link>
              </Button>
            )}
            <button
              type="button"
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl text-esi-text-secondary transition-colors hover:bg-surface-2"
              aria-label={open ? "بستن منو" : "باز کردن منو"}
              aria-expanded={open}
              aria-controls="public-mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <Icon name={open ? "X" : "Menu"} size={22} />
            </button>
          </div>
        </div>
      </div>
      {open && (
        <nav
          id="public-mobile-menu"
          className="border-t border-border bg-surface-1 md:hidden"
          aria-label="ناوبری موبایل"
        >
          <div className="space-y-1 px-4 py-3">
            {LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block min-h-11 rounded-lg px-3 py-3 text-sm text-esi-text-secondary transition-colors hover:bg-surface-2"
              >
                {item.label}
              </Link>
            ))}
            {!session && (
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="block min-h-11 rounded-lg bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground"
              >
                ورود / ثبت‌نام
              </Link>
            )}
          </div>
        </nav>
      )}
      {open && createPortal(
        <button
          type="button"
          tabIndex={-1}
          aria-label="بستن منو"
          className="fixed inset-0 z-30 cursor-default bg-black/65 md:hidden"
          onClick={() => setOpen(false)}
        />,
        document.body,
      )}
    </header>
  );
}
