"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion/motion";

/** Theme toggle — system / light / dark cycle with spring icon swap. */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const reduce = useReducedMotion();
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-11 w-11", className)} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "حالت روشن" : "حالت تاریک"}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full text-esi-text-secondary hover:text-esi-text-primary hover:bg-surface-2 transition-colors duration-150 active:scale-95",
        className,
      )}
    >
      <motion.span
        key={isDark ? "sun" : "moon"}
        initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -40, scale: 0.8 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={reduce ? { duration: 0.01 } : MOTION.spring.soft}
      >
        <Icon name={isDark ? "Sun" : "Moon"} size={20} />
      </motion.span>
    </button>
  );
}
