"use client";

import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";

/** Hairline reading-progress bar for long public pages. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  if (reduce) return null;
  return <motion.div aria-hidden className="esi-scroll-progress" style={{ scaleX }} />;
}
