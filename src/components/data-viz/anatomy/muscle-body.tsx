"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { bodyFrontData } from "./bodyFront";
import { bodyBackData } from "./bodyBack";
import { bodyFemaleFrontData } from "./bodyFemaleFront";
import { bodyFemaleBackData } from "./bodyFemaleBack";
import {
  BODY_SLUG_FA,
  MUSCLE_GROUP_TO_BODY,
  slugVisibleOn,
  TRAINED_SLUGS,
  type BodySlug,
} from "./muscle-mapping";
import { cn } from "@/lib/utils";

/**
 * MuscleBody — premium animated anatomy renderer on top of vendored
 * react-muscle-highlighter geometry (MIT). Theme-aware fills via CSS
 * color-mix, animated fill transitions (reduced-motion safe), tap/hover
 * feedback, and an accessible text fallback.
 *
 * Two modes:
 *  - display:     both views side by side, intensity map 0–100 per muscle group
 *  - interactive: single view + gender/side toggles handled by parent,
 *                 selection callbacks per muscle with glow transitions
 */

export type Gender = "male" | "female";
export type BodySide = "front" | "back";

type BodyPart = { slug: string; color: string; path: { left: string[]; right: string[] } };

const MODELS: Record<`${Gender}-${BodySide}`, { parts: BodyPart[]; viewBox: string }> = {
  "male-front": { parts: bodyFrontData as unknown as BodyPart[], viewBox: "0 0 724 1448" },
  "male-back": { parts: bodyBackData as unknown as BodyPart[], viewBox: "724 0 724 1448" },
  "female-front": { parts: bodyFemaleFrontData as unknown as BodyPart[], viewBox: "-50 -40 734 1538" },
  "female-back": { parts: bodyFemaleBackData as unknown as BodyPart[], viewBox: "756 0 774 1448" },
};

export type MuscleBodyProps = {
  mode?: "display" | "interactive";
  /** intensity per EsiFit muscle-group slug, 0..100 (display mode) */
  intensity?: Record<string, number>;
  /** selected body slugs (interactive mode) */
  selected?: Set<BodySlug>;
  /** disabled (pain) slugs — rendered with warning tint */
  painSlugs?: Set<BodySlug>;
  onToggle?: (slug: BodySlug) => void;
  onHover?: (slug: BodySlug | null) => void;
  gender?: Gender;
  side?: BodySide;
  className?: string;
  height?: number;
  ariaLabel?: string;
};

function intensityFill(intensity01: number): string {
  const pct = Math.round(18 + Math.min(1, Math.max(0, intensity01)) * 82);
  return `color-mix(in srgb, var(--primary) ${pct}%, var(--surface-3))`;
}

/** One <svg> body. Paths animate fill via CSS transitions (var-compatible). */
function BodySvg({
  gender,
  side,
  mode,
  intensityBySlug,
  selected,
  painSlugs,
  onToggle,
  onHover,
  height,
  className,
}: {
  gender: Gender;
  side: BodySide;
  mode: "display" | "interactive";
  intensityBySlug: Partial<Record<BodySlug, number>>;
  selected?: Set<BodySlug>;
  painSlugs?: Set<BodySlug>;
  onToggle?: (slug: BodySlug) => void;
  onHover?: (slug: BodySlug | null) => void;
  height: number;
  className?: string;
}) {
  const model = MODELS[`${gender}-${side}`];
  const interactive = mode === "interactive";

  return (
    <motion.svg
      key={`${gender}-${side}`}
      viewBox={model.viewBox}
      style={{ height, width: "auto", display: "block" }}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`آناتومی بدن — نمای ${side === "front" ? "روبرو" : "پشت"} (${gender === "male" ? "مرد" : "زن"})`}
      initial={{ opacity: 0, scale: 0.985, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {model.parts.map((part, pi) => {
        const slug = part.slug as BodySlug;
        const trained = TRAINED_SLUGS.includes(slug);
        const isSelected = selected?.has(slug) ?? false;
        const isPain = painSlugs?.has(slug) ?? false;
        const rawIntensity = intensityBySlug[slug] ?? 0;

        let fill = "var(--surface-3)";
        if (isPain) fill = "color-mix(in srgb, var(--destructive) 45%, var(--surface-3))";
        else if (isSelected) fill = "var(--primary)";
        else if (rawIntensity > 0) fill = intensityFill(rawIntensity);

        const paths = [...(part.path.left ?? []), ...(part.path.right ?? [])];
        const label = BODY_SLUG_FA[slug] ?? slug;
        const clickable = interactive && trained;

        return paths.map((d, i) => (
          <motion.path
            key={`${pi}-${slug}-${i}`}
            d={d}
            fill={fill}
            stroke={isSelected ? "var(--primary)" : "var(--border)"}
            strokeWidth={isSelected ? 2 : 0.75}
            vectorEffect="non-scaling-stroke"
            style={{
              transition: "fill 420ms var(--ease-smooth), stroke 240ms var(--ease-smooth)",
              cursor: clickable ? "pointer" : "default",
              ...(isSelected ? { filter: "drop-shadow(0 0 10px color-mix(in srgb, var(--primary) 60%, transparent))" } : {}),
            }}
            {...(clickable
              ? {
                  onClick: () => onToggle?.(slug),
                  onMouseEnter: () => onHover?.(slug),
                  onMouseLeave: () => onHover?.(null),
                  whileTap: { scale: 0.99 },
                }
              : {})}
          >
            <title>{label}</title>
          </motion.path>
        ));
      })}
    </motion.svg>
  );
}

export function MuscleBody({
  mode = "display",
  intensity,
  selected,
  painSlugs,
  onToggle,
  onHover,
  gender = "male",
  side = "front",
  className,
  height = 380,
  ariaLabel,
}: MuscleBodyProps) {
  const reduceMotion = useReducedMotion();

  // Aggregate EsiFit muscle-group intensities onto body slugs (max wins —
  // "how hard did this region work", not sum, so front/side delts don't triple).
  const intensityBySlug = React.useMemo(() => {
    const bySlug: Partial<Record<BodySlug, number>> = {};
    if (!intensity) return bySlug;
    for (const [groupSlug, value] of Object.entries(intensity)) {
      const body = MUSCLE_GROUP_TO_BODY[groupSlug];
      if (!body) continue;
      bySlug[body] = Math.max(bySlug[body] ?? 0, value);
    }
    return bySlug;
  }, [intensity]);

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  if (mode === "display") {
    return (
      <div className={cn("flex items-end justify-center gap-2 sm:gap-6", className)} dir="ltr">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`f-${gender}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
            <BodySvg
              gender={gender}
              side="front"
              mode="display"
              intensityBySlug={intensityBySlug}
              height={height}
            />
          </motion.div>
          <motion.div key={`b-${gender}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
            <BodySvg
              gender={gender}
              side="back"
              mode="display"
              intensityBySlug={intensityBySlug}
              height={height}
            />
          </motion.div>
        </AnimatePresence>
        {/* Non-visual summary for screen readers */}
        <span className="sr-only">
          {ariaLabel ?? "نقشه درگیری عضلات"}:{" "}
          {Object.entries(intensityBySlug)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([slug, v]) => `${BODY_SLUG_FA[slug]} (${v}٪)`)
            .join("، ") || "داده‌ای موجود نیست"}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <BodySvg
        gender={gender}
        side={side}
        mode="interactive"
        intensityBySlug={intensityBySlug}
        selected={selected}
        painSlugs={painSlugs}
        onToggle={onToggle}
        onHover={onHover}
        height={height}
      />
    </div>
  );
}

export { slugVisibleOn, BODY_SLUG_FA, TRAINED_SLUGS };
export type { BodySlug };
