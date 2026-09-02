"use client";

import * as React from "react";
import { animate, motion, useMotionValue, useTransform, useReducedMotion } from "framer-motion";
import { formatNumber, toPersianDigits } from "@/lib/formatting/numbers";

/**
 * AnimatedCounter — count motion token (600ms smooth).
 * Reduced motion renders the final value immediately.
 */
export function AnimatedCounter({
  value,
  format = "number",
  digits = 0,
  suffix,
  prefix,
  duration = 0.6,
  className,
}: {
  value: number;
  format?: "number" | "decimal" | "clock" | "raw";
  digits?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const [display, setDisplay] = React.useState(reduced ? value : 0);

  React.useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, reduced]);

  let rendered: string;
  switch (format) {
    case "decimal":
      rendered = formatNumber(display, { minimumFractionDigits: digits, maximumFractionDigits: digits });
      break;
    case "clock":
      rendered = toPersianDigits(
        `${Math.floor(display / 60)}:${String(Math.floor(display % 60)).padStart(2, "0")}`,
      );
      break;
    case "raw":
      rendered = String(Math.round(display));
      break;
    default:
      rendered = formatNumber(display, { maximumFractionDigits: 0 });
  }

  return (
    <motion.span className={className} aria-label={`${rendered}${suffix ?? ""}`}>
      {prefix}
      {rendered}
      {suffix}
    </motion.span>
  );
}
