"use client";

import * as React from "react";

/**
 * One pointer listener for the whole app: writes the cursor position (relative
 * to the hovered card) into --mx/--my, which `.esi-card` turns into a soft
 * spotlight. Delegated, rAF-throttled, and a no-op for touch / reduced motion.
 */
export function SpotlightProvider() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let lastEvent: PointerEvent | null = null;

    const apply = () => {
      frame = 0;
      const e = lastEvent;
      if (!e) return;
      const target = (e.target as Element | null)?.closest<HTMLElement>(".esi-card");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      target.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };

    const onMove = (e: PointerEvent) => {
      lastEvent = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
