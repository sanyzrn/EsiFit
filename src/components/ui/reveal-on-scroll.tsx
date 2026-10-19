"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * RevealOnScroll — fade + rise once. Triggers as soon as a sliver is visible
 * (no negative margin: tall blocks and short viewports must never stay hidden),
 * and is a no-op under reduced motion.
 */
export function RevealOnScroll({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const reduced = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}
