"use client";

import * as React from "react";
import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  BODY_SLUG_FA,
  MUSCLE_GROUP_TO_BODY,
  slugVisibleOn,
  TRAINED_SLUGS,
  type BodySlug,
} from "./muscle-mapping";
import { cn } from "@/lib/utils";

/**
 * MuscleBody — EsiFit's anatomy view, rendered by the real
 * `react-muscle-highlighter` package (MIT, github.com/soroojshehryar/react-muscle-highlighter).
 *
 * The library owns the geometry: all four models (male/female × front/back),
 * every region including head, hair, neck, hands, feet and the body outline.
 * This wrapper only supplies EsiFit's theme-aware fills, selection/pain states,
 * hover feedback, entrance motion and a Persian text alternative.
 *
 * Two modes:
 *  - display:     both views side by side, intensity map 0–100 per muscle group
 *  - interactive: single view; click toggles trained regions, hover reports the slug
 */

export type Gender = "male" | "female";
export type BodySide = "front" | "back";

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

/** The library draws its svg at 400px tall at scale 1. */
const LIB_BASE_HEIGHT = 400;

function intensityFill(intensity01: number): string {
  const pct = Math.round(26 + Math.min(1, Math.max(0, intensity01)) * 74);
  return `color-mix(in oklab, var(--primary) ${pct}%, var(--surface-3))`;
}

/** Resting colour of a region: lifted off the card so the whole figure reads, not just the lit muscles. */
const NEUTRAL_FILL = "color-mix(in oklab, var(--surface-3) 80%, var(--text-muted))";

const ALL_SLUGS: Slug[] = [
  "abs", "adductors", "ankles", "biceps", "calves", "chest", "deltoids", "feet", "forearm",
  "gluteal", "hamstring", "hands", "hair", "head", "knees", "lower-back", "neck", "obliques",
  "quadriceps", "tibialis", "trapezius", "triceps", "upper-back",
];

const TRAINED_SELECTOR = TRAINED_SLUGS.map((s) => `#${cssEscape(s)}`).join(",");
/** Slugs like "lower-back" are valid CSS idents already; keep a hook for safety. */
function cssEscape(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

/** One <Body> with EsiFit's state layered on as per-part fills. */
function BodyView({
  gender,
  side,
  mode,
  intensityBySlug,
  selected,
  painSlugs,
  onToggle,
  onHover,
  height,
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
}) {
  const interactive = mode === "interactive";
  const scope = `esi-anatomy-${React.useId().replace(/:/g, "")}`;

  const data = React.useMemo<ExtendedBodyPart[]>(() => {
    const parts: ExtendedBodyPart[] = [];
    // Every slug gets an explicit fill: the library otherwise falls back to its own
    // per-region greys, which clash with the EsiFit surfaces (head, hair, hands, feet…).
    for (const slug of ALL_SLUGS) {
      if (slug === "head") {
        parts.push({ slug, styles: { fill: "color-mix(in oklab, var(--text-muted) 38%, var(--surface-3))" } });
      } else if (slug === "hair") {
        parts.push({ slug, styles: { fill: "color-mix(in oklab, var(--background) 55%, var(--surface-3))" } });
      } else if (selected?.has(slug as BodySlug) && interactive) {
        parts.push({ slug, styles: { fill: "var(--primary)", stroke: "var(--primary)", strokeWidth: 6 } });
      } else if (painSlugs?.has(slug as BodySlug)) {
        parts.push({ slug, styles: { fill: "color-mix(in oklab, var(--destructive) 50%, var(--surface-3))" } });
      } else if ((intensityBySlug[slug as BodySlug] ?? 0) > 0) {
        parts.push({ slug, styles: { fill: intensityFill((intensityBySlug[slug as BodySlug] ?? 0) / 100) } });
      } else {
        parts.push({ slug, styles: { fill: NEUTRAL_FILL } });
      }
    }
    return parts;
  }, [intensityBySlug, selected, painSlugs, interactive]);

  const handlePress = React.useCallback(
    (part: ExtendedBodyPart) => {
      const slug = part.slug as BodySlug | undefined;
      if (!interactive || !slug || !TRAINED_SLUGS.includes(slug)) return;
      onToggle?.(slug);
    },
    [interactive, onToggle],
  );

  const reportHover = (target: EventTarget | null) => {
    const id = (target as Element | null)?.id as BodySlug | undefined;
    onHover?.(id && TRAINED_SLUGS.includes(id) && slugVisibleOn(id, side) ? id : null);
  };

  return (
    <div
      className={scope}
      data-interactive={interactive}
      onPointerOver={interactive ? (e) => reportHover(e.target) : undefined}
      onPointerLeave={interactive ? () => onHover?.(null) : undefined}
    >
      {/* Scoped styling for the library's svg: smooth fills, honest cursors, hover lift. */}
      <style>{`
        .${scope} path { cursor: default !important; transition: fill 420ms var(--ease-smooth), stroke 240ms var(--ease-smooth), filter 240ms var(--ease-smooth); }
        .${scope}[data-interactive="true"] :is(${TRAINED_SELECTOR}) { cursor: pointer !important; }
        .${scope}[data-interactive="true"] :is(${TRAINED_SELECTOR}):hover { filter: brightness(1.28) saturate(1.1); }
        .${scope} path[stroke-width="6"] { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--primary) 60%, transparent)); }
      `}</style>
      <Body
        data={data}
        gender={gender}
        side={side}
        scale={height / LIB_BASE_HEIGHT}
        onBodyPartPress={interactive ? handlePress : undefined}
        defaultFill={NEUTRAL_FILL}
        defaultStroke="var(--border)"
        defaultStrokeWidth={2.5}
        border="color-mix(in srgb, var(--text-muted) 55%, transparent)"
      />
    </div>
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
  const enter = reduceMotion ? false : ({ opacity: 0, scale: 0.985, y: 6 } as const);

  if (mode === "display") {
    return (
      <div className={cn("flex items-end justify-center gap-2 sm:gap-6", className)} dir="ltr" role="group" aria-label={ariaLabel ?? "نقشه درگیری عضلات"}>
        {(["front", "back"] as const).map((s) => (
          <motion.div
            key={`${s}-${gender}`}
            initial={enter}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={transition}
            aria-hidden
          >
            <BodyView gender={gender} side={s} mode="display" intensityBySlug={intensityBySlug} height={height} />
          </motion.div>
        ))}
        {/* Non-visual summary for screen readers */}
        <span className="sr-only">
          {ariaLabel ?? "نقشه درگیری عضلات"}:{" "}
          {Object.entries(intensityBySlug)
            .filter(([, v]) => (v ?? 0) > 0)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .slice(0, 5)
            .map(([slug, v]) => `${BODY_SLUG_FA[slug as BodySlug]} (${v}٪)`)
            .join("، ") || "داده‌ای موجود نیست"}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      key={`${gender}-${side}`}
      className={cn("flex items-center justify-center", className)}
      initial={enter}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={transition}
      role="group"
      aria-label={`آناتومی بدن — نمای ${side === "front" ? "روبرو" : "پشت"} (${gender === "male" ? "مرد" : "زن"})`}
    >
      <BodyView
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
    </motion.div>
  );
}

export { slugVisibleOn, BODY_SLUG_FA, TRAINED_SLUGS };
export type { BodySlug };
