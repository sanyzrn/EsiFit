"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Khatam — the eight-point star of Persian tilework, EsiFit's recurring motif.
 * `KhatamStar` is the bare geometry; `KhatamDial` turns it into the score dial
 * (a ring of 60 ticks that ignite in sequence, framed by two counter-rotating
 * stars); `KhatamMark` is the logo glyph.
 */

/** Inner/outer radius ratio of an {8/2} octagram — two overlaid squares, the classic khatam. */
const OCTAGRAM_INNER = Math.SQRT1_2 / Math.cos(Math.PI / 8);

/** Points of an n-pointed star centred at (cx, cy). */
export function starPath(cx: number, cy: number, outer: number, inner: number, points = 8, rotation = -90): string {
  const pts: string[] = [];
  for (let k = 0; k < points * 2; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = ((rotation + (k * 180) / points) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")}Z`;
}

export function KhatamStar({
  size = 120,
  className,
  strokeWidth = 1,
  spin = false,
  title,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
  spin?: boolean | "reverse";
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={cn(spin === true && "esi-spin-slow", spin === "reverse" && "esi-spin-slower", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={starPath(50, 50, 48, OCTAGRAM_INNER * 48)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d={starPath(50, 50, 33, OCTAGRAM_INNER * 33, 8, -67.5)} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" opacity={0.6} />
      <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth={strokeWidth} opacity={0.6} />
    </svg>
  );
}

const TICKS = 60;

export function KhatamDial({
  value,
  size = 220,
  color = "var(--primary)",
  children,
  label,
  className,
  delay = 0.25,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  color?: string;
  children?: React.ReactNode;
  label?: string;
  className?: string;
  /** Seconds before the ticks start igniting. */
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const pct = Math.min(100, Math.max(0, value)) / 100;
  const lit = Math.round(pct * TICKS);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
        {/* two counter-rotating stars: the "machinery" behind the number */}
        <g style={{ transformOrigin: "100px 100px", color: "var(--border)" }}>
          <path d={starPath(100, 100, 74, 74 * OCTAGRAM_INNER)} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </g>
        {Array.from({ length: TICKS }, (_, i) => {
          const angle = ((i / TICKS) * 360 - 90) * (Math.PI / 180);
          const major = i % 5 === 0;
          const r1 = 96;
          const r2 = major ? 84 : 88;
          // Rounded: raw floats differ in the last digits between Node and the browser.
          const x1 = Number((100 + Math.cos(angle) * r1).toFixed(2));
          const y1 = Number((100 + Math.sin(angle) * r1).toFixed(2));
          const x2 = Number((100 + Math.cos(angle) * r2).toFixed(2));
          const y2 = Number((100 + Math.sin(angle) * r2).toFixed(2));
          const on = i < lit;
          return (
            <motion.line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeLinecap="round"
              strokeWidth={major ? 3 : 2.2}
              stroke={on ? color : "var(--surface-3)"}
              initial={reduce ? false : { opacity: 0.25, scale: 0.6 }}
              animate={{ opacity: on ? 1 : 0.9, scale: 1 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : delay + i * 0.016, ease: [0.22, 1, 0.36, 1] }}
              style={{
                transformOrigin: "100px 100px",
              }}
            />
          );
        })}
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Logo glyph: saffron khatam with a lapis dumbbell at its heart. */
export function KhatamMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <path d={starPath(24, 24, 23, 23 * OCTAGRAM_INNER)} fill="var(--primary)" />
      <g stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M14 20v8M18 17v14M30 17v14M34 20v8M18 24h12" />
      </g>
    </svg>
  );
}
