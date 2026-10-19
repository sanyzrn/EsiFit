import * as React from "react";
import { cn } from "@/lib/utils";

/** Endless ticker. Content is duplicated once; the keyframe slides by exactly half. */
export function Marquee({ items, className }: { items: React.ReactNode[]; className?: string }) {
  const row = (suffix: string) =>
    items.map((item, i) => (
      <span key={`${suffix}-${i}`} className="inline-flex items-center gap-8 pe-8 whitespace-nowrap">
        {item}
        <span aria-hidden className="text-primary/70">
          ✦
        </span>
      </span>
    ));
  return (
    <div className={cn("esi-marquee-wrap overflow-hidden", className)} dir="rtl">
      <div className="esi-marquee flex items-center" aria-hidden>
        {row("a")}
        {row("b")}
      </div>
      <span className="sr-only">{items.map((i) => (typeof i === "string" ? i : "")).join("، ")}</span>
    </div>
  );
}
