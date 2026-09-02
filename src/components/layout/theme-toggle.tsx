"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Theme toggle — system / light / dark cycle with spring icon swap. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
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
        "inline-flex h-11 w-11 items-center justify-center rounded-full text-esi-text-secondary hover:text-esi-text-primary hover:bg-surface-2 transition-colors duration-150",
        className,
      )}
    >
      <Icon name={isDark ? "Sun" : "Moon"} size={20} />
    </button>
  );
}
