"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MuscleBody, BODY_SLUG_FA, TRAINED_SLUGS, type BodySlug, type Gender, type BodySide } from "./muscle-body";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * AnatomyExplorer — premium interactive muscle selection (DESIGN_BIBLE:
 * signature interaction). Tap a muscle on the body or a chip; the selection
 * glows with an animated highlight, the caption names the muscle, and the
 * parent receives the set for exercise filtering.
 * Fully keyboard-accessible via the chip row; the SVG is the visual twin.
 */

export type AnatomyExplorerProps = {
  selected: Set<BodySlug>;
  onChange: (next: Set<BodySlug>) => void;
  /** Intensity overlay (e.g. from today's plan) shown beneath the selection. */
  intensity?: Record<string, number>;
  /** Disable selection; show intensity only (display mode + toggles). */
  readOnly?: boolean;
  className?: string;
  height?: number;
};

export function AnatomyExplorer({
  selected,
  onChange,
  intensity,
  readOnly = false,
  className,
  height = 340,
}: AnatomyExplorerProps) {
  const reduceMotion = useReducedMotion();
  const [gender, setGender] = React.useState<Gender>("male");
  const [side, setSide] = React.useState<BodySide>("front");
  const [hovered, setHovered] = React.useState<BodySlug | null>(null);

  const toggle = (slug: BodySlug) => {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange(next);
  };

  const visibleSlugs = TRAINED_SLUGS.filter((s) => (side === "front" ? true : true)); // both views list all
  const caption = hovered ?? (selected.size === 1 ? [...selected][0] : null);

  return (
    <div className={cn("rounded-3xl border border-border bg-surface-1 p-5", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="نمای بدن">
          {(["front", "back"] as BodySide[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                side === s ? "text-primary-foreground" : "text-esi-text-secondary hover:text-esi-text-primary",
              )}
            >
              {side === s && (
                <motion.span
                  layoutId={reduceMotion ? undefined : "anatomy-side-pill"}
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  aria-hidden
                />
              )}
              <span className="relative z-10">{s === "front" ? "روبرو" : "پشت"}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="آناتومی">
          {(["male", "female"] as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              aria-pressed={gender === g}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                gender === g ? "text-primary-foreground" : "text-esi-text-secondary hover:text-esi-text-primary",
              )}
            >
              {gender === g && (
                <motion.span
                  layoutId={reduceMotion ? undefined : "anatomy-gender-pill"}
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  aria-hidden
                />
              )}
              <span className="relative z-10">{g === "male" ? "مرد" : "زن"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body + caption */}
      <div className="relative flex flex-col items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${gender}-${side}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <MuscleBody
              mode="interactive"
              gender={gender}
              side={side}
              selected={selected}
              intensity={intensity}
              onToggle={toggle}
              onHover={setHovered}
              height={height}
            />
          </motion.div>
        </AnimatePresence>

        {/* Caption bubble */}
        <div className="mt-2 h-7 flex items-center justify-center" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={caption ?? (selected.size > 1 ? "multi" : "none")}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              className="text-xs font-semibold text-esi-text-secondary"
            >
              {caption
                ? BODY_SLUG_FA[caption]
                : selected.size > 1
                  ? `${toPersianDigits(selected.size)} عضله انتخاب شده`
                  : readOnly
                    ? "برای فیلتر، عضله‌ای را انتخاب کنید"
                    : "روی عضله بزنید یا از فهرست پایین انتخاب کنید"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Chip row — keyboard accessible twin of the SVG selection */}
      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="فهرست عضلات">
        {visibleSlugs.map((slug) => {
          const active = selected.has(slug);
          return (
            <motion.button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              aria-pressed={active}
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200",
                active
                  ? "bg-primary text-primary-foreground esi-glow"
                  : "bg-surface-2 text-esi-text-secondary hover:bg-surface-3 hover:text-esi-text-primary",
              )}
            >
              {BODY_SLUG_FA[slug]}
            </motion.button>
          );
        })}
      </div>

      {!readOnly && selected.size > 0 && (
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="mt-3 text-[11px] text-esi-text-muted hover:text-esi-text-primary transition-colors"
        >
          پاک کردن انتخاب ({toPersianDigits(selected.size)})
        </button>
      )}
    </div>
  );
}
