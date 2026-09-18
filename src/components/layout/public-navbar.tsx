"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BrandMark } from "@/components/layout/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/client/use-session";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion/motion";

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
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-40 transition-all duration-300 safe-top",
        scrolled ? "esi-glass border-b border-border" : "bg-transparent",
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
                className="rounded-lg px-3 py-2 text-sm text-esi-text-secondary hover:text-esi-text-primary hover:bg-surface-2/60 transition-colors min-h-11 inline-flex items-center"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-10 w-10" />
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
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full text-esi-text-secondary transition-transform active:scale-95"
              aria-label={open ? "بستن منو" : "باز کردن منو"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <motion.span
                animate={{ rotate: open ? 90 : 0 }}
                transition={{ duration: reduce ? 0.01 : MOTION.duration.snappy, ease: MOTION.ease }}
              >
                <Icon name={open ? "X" : "Menu"} size={22} />
              </motion.span>
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.nav
            key="public-mobile-menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0.01 : MOTION.duration.smooth, ease: MOTION.ease }}
            className="md:hidden border-t border-border esi-glass overflow-hidden"
            aria-label="ناوبری موبایل"
          >
            <div className="px-4 py-3 space-y-1">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-sm text-esi-text-secondary hover:bg-surface-2 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
              {!session && (
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg bg-primary px-3 py-3 text-center text-sm font-semibold text-primary-foreground"
                >
                  ورود / ثبت‌نام
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
