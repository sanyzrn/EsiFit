/**
 * Shared motion tokens for EsiFit (DESIGN_BIBLE-aligned).
 * Always gate framer-motion with useReducedMotion — CSS media queries do not
 * stop JS animations.
 */
export const MOTION = {
  ease: [0.22, 1, 0.36, 1] as const,
  duration: {
    snappy: 0.18,
    smooth: 0.32,
    enter: 0.38,
    count: 0.6,
    chart: 0.8,
  },
  spring: {
    soft: { type: "spring" as const, stiffness: 380, damping: 30 },
    pill: { type: "spring" as const, stiffness: 420, damping: 34 },
  },
} as const;

export function entrance(i = 0, reduce?: boolean | null) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduce
      ? { duration: 0.01 }
      : { duration: MOTION.duration.enter, ease: MOTION.ease, delay: Math.min(i * 0.05, 0.35) },
  };
}
