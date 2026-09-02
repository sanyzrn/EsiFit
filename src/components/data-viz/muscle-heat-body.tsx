"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUPS } from "@/features/workouts/data/exercise-dataset";

/**
 * MuscleHeatBody — signature anatomical training-volume map (DESIGN_BIBLE §11).
 * Stylized rounded anatomy, front + back views. Intensity 0..100 per muscle slug.
 * Non-visual equivalent list is rendered alongside (a11y requirement).
 * Hover/focus/tap: shows region tooltip — never hover-only info.
 */

export type MuscleIntensityMap = Record<string, number>; // slug → 0..100

type RegionDef = {
  slugs: string[]; // muscle group slugs this visual region represents
  path: string;
  mirrored?: boolean; // draw on both sides
};

const SILHOUETTE_FRONT =
  "M100 18 c14 0 24 10 24 24 0 10-6 19-13 22 8 3 18 7 26 13 10 7 17 16 20 30 l9 44 c2 10-12 15-15 5 l-8-30 -2 60 c0 8-1 20-3 30 -3 16-6 30-7 44 l-5 78 c-1 10-6 16-14 16 h-14 c-8 0-13-6-14-16 l-6-64 -8-38 -8 38 -6 64 c-1 10-6 16-14 16 h-14 c-8 0-13-6-14-16 l-5-78 c-1-14-4-28-7-44 -2-10-3-22-3-30 l-2-60 -8 30 c-3 10-17 5-15-5 l9-44 c3-14 10-23 20-30 8-6 18-10 26-13 -7-3-13-12-13-22 0-14 10-24 24-24 z";

const SILHOUETTE_BACK = SILHOUETTE_FRONT;

// Front-view muscle regions (x-coordinates are for the LEFT half; mirrored to right)
const FRONT_REGIONS: RegionDef[] = [
  // Chest (upper + main) — left pec
  { slugs: ["chest", "chest_upper"], path: "M97 96 c-12 2-24 6-30 12 -4 4-5 12-3 20 2 9 8 16 16 19 6 2 12 2 17 0 z", mirrored: true },
  // Front delts
  { slugs: ["front_delts"], path: "M96 94 c-10 1-19 5-24 10 -3 3-4 8-3 12 5-2 11-3 16-3 4 0 8 1 11 2 z", mirrored: true },
  // Biceps (upper arm front)
  { slugs: ["biceps"], path: "M63 122 c-5 2-9 7-12 14 -3 8-5 18-6 28 l-2 18 c0 6 2 9 6 9 5 0 8-3 9-9 l4-24 c2-10 3-22 3-30 z", mirrored: true },
  // Forearms
  { slugs: ["forearms"], path: "M46 196 c-4 1-6 4-6 9 0 9 1 20 2 30 1 8 2 14 3 18 1 4 3 6 6 6 3 0 5-2 5-6 1-5 1-12 1-19 0-11-2-24-4-32 z", mirrored: true },
  // Abs
  { slugs: ["abs"], path: "M100 152 c-8 0-15 2-19 5 -3 3-4 9-3 16 1 8 3 16 3 24 0 8-2 15-2 22 0 8 2 14 7 18 4 3 9 4 14 4 z", mirrored: true },
  // Obliques
  { slugs: ["obliques"], path: "M76 160 c-4 6-6 14-6 22 0 9 1 18 1 26 0 8-2 14-1 20 1 5 4 8 9 9 3-6 4-14 4-22 0-9-1-18-1-27 0-10-2-20-6-28 z", mirrored: true },
  // Quads
  { slugs: ["quads"], path: "M94 254 c-8 0-15 3-18 9 -4 8-5 20-4 32 1 14 3 28 5 40 1 7 4 11 9 11 5 0 7-4 8-11 l3-40 c1-13 1-27 0-40 z", mirrored: true },
  // Adductors (inner thigh)
  { slugs: ["adductors"], path: "M99 268 c-4 0-7 1-8 3 -2 4-2 10-1 16 1 7 3 13 5 18 1 3 3 4 4 4 2 0 3-2 3-5 0-6 0-12 0-18 0-6-1-12-3-18 z", mirrored: true },
  // Calves (front-ish lower leg)
  { slugs: ["calves"], path: "M74 352 c-3 8-4 18-3 28 1 12 3 24 5 34 1 5 3 8 6 8 3 0 5-3 5-8 1-11 1-23 0-34 0-11-1-21-3-28 z", mirrored: true },
];

// Back-view regions
const BACK_REGIONS: RegionDef[] = [
  // Traps
  { slugs: ["traps"], path: "M100 92 c-13 1-26 5-33 11 -3 3-4 7-2 10 3 4 9 4 14 2 7-3 14-5 21-5 z", mirrored: true },
  // Lats
  { slugs: ["lats"], path: "M97 118 c-10 1-20 5-25 11 -4 5-5 14-4 24 1 12 5 24 11 32 5 6 11 9 18 9 z", mirrored: true },
  // Upper back / rear delts
  { slugs: ["upper_back", "rear_delts"], path: "M70 100 c-8 4-14 11-17 19 -2 6-1 11 2 13 4 3 9 1 12-4 4-7 9-13 15-17 z", mirrored: true },
  // Lower back
  { slugs: ["lower_back"], path: "M100 196 c-6 0-11 2-14 6 -2 3-3 8-3 13 0 6 1 12 3 16 3 5 8 8 14 8 z", mirrored: true },
  // Triceps
  { slugs: ["triceps"], path: "M64 124 c-5 3-9 8-11 15 -2 8-4 18-5 28 l-1 15 c0 6 2 9 6 9 4 0 7-3 8-8 l3-22 c2-11 2-26 0-37 z", mirrored: true },
  // Glutes
  { slugs: ["glutes"], path: "M97 232 c-9 0-17 4-20 11 -3 7-3 16 0 22 4 7 11 11 20 11 z", mirrored: true },
  // Hamstrings
  { slugs: ["hamstrings"], path: "M93 258 c-8 1-13 5-16 11 -3 7-4 17-4 27 0 12 1 24 3 34 1 6 4 10 8 10 4 0 7-4 8-10 2-11 3-23 3-35 0-12 0-25-2-37 z", mirrored: true },
  // Calves
  { slugs: ["calves"], path: "M75 348 c-4 9-6 20-5 31 1 12 3 24 5 33 1 5 3 8 6 8 3 0 5-3 5-8 1-11 1-23 0-33 -1-12-2-23-4-31 z", mirrored: true },
];

function intensityFor(slugs: string[], map: MuscleIntensityMap): number {
  return Math.max(0, ...slugs.map((s) => map[s] ?? 0));
}

function colorFor(intensity: number, interactive: boolean, hovered: boolean): string {
  if (hovered && interactive) return "#4F8CFF";
  if (intensity <= 0) return "var(--surface-3)";
  // mint ramp: 0 → surface, high → full mint
  const t = Math.min(1, intensity / 100);
  return `color-mix(in srgb, var(--primary) ${Math.round(18 + t * 82)}%, var(--surface-2))`;
}

export function MuscleHeatBody({
  intensity,
  compact = false,
  className,
}: {
  intensity: MuscleIntensityMap;
  compact?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [focusedRegion, setFocusedRegion] = React.useState<string | null>(null);

  const views: Array<{ key: "front" | "back"; label: string; silhouette: string; regions: RegionDef[] }> = [
    { key: "front", label: "نمای روبه‌رو", silhouette: SILHOUETTE_FRONT, regions: FRONT_REGIONS },
    { key: "back", label: "نمای پشت", silhouette: SILHOUETTE_BACK, regions: BACK_REGIONS },
  ];

  const regionName = (slugs: string[]) =>
    slugs.map((s) => MUSCLE_GROUPS.find((m) => m.slug === s)?.nameFa ?? s).join("، ");

  const activeRegion = hovered ?? focusedRegion;

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("grid gap-6", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        {views.map((view) => (
          <figure key={view.key} className="flex flex-col items-center gap-2">
            <svg
              viewBox="0 0 200 470"
              className="w-full max-w-[180px]"
              role="img"
              aria-label={`${view.label} — نقشه حجم تمرینی`}
            >
              {/* silhouette */}
              <path d={view.silhouette} fill="var(--surface-2)" stroke="var(--border)" strokeWidth={1.5} />
              {/* regions */}
              {view.regions.map((region, idx) => {
                const intensityValue = intensityFor(region.slugs, intensity);
                const key = `${view.key}-${region.slugs.join("+")}`;
                const isHovered = activeRegion === key;
                const common = {
                  d: region.path,
                  fill: colorFor(intensityValue, true, isHovered),
                  tabIndex: 0,
                  role: "img" as const,
                  "aria-label": `${regionName(region.slugs)}: شدت ${Math.round(intensityValue)} از ۱۰۰`,
                  onMouseEnter: () => setHovered(key),
                  onMouseLeave: () => setHovered(null),
                  onFocus: () => setFocusedRegion(key),
                  onBlur: () => setFocusedRegion(null),
                  className: "outline-none cursor-pointer transition-colors",
                };
                const pathEl = reduced ? (
                  <path {...common} />
                ) : (
                  <motion.path
                    {...common}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 + idx * 0.03, duration: 0.4 }}
                  />
                );
                return (
                  <g key={key}>
                    {pathEl}
                    {region.mirrored && (
                      <g transform="scale(-1,1) translate(-200,0)">
                        {reduced ? (
                          <path {...common} tabIndex={-1} />
                        ) : (
                          <motion.path {...common} tabIndex={-1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + idx * 0.03, duration: 0.4 }} />
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            <figcaption className="text-xs text-esi-text-muted">{view.label}</figcaption>
          </figure>
        ))}
      </div>

      {/* Hover detail — also keyboard/tap reachable */}
      <div className="mt-3 min-h-[20px] text-center text-sm">
        {activeRegion ? (
          (() => {
            const view = activeRegion.startsWith("front") ? FRONT_REGIONS : BACK_REGIONS;
            const region = view.find((r) => `${r.path}` && `${activeRegion.endsWith(r.slugs.join("+"))}`) ??
              view.find((r) => activeRegion.includes(r.slugs.join("+"))) ?? view[0];
            const value = intensityFor(region.slugs, intensity);
            return (
              <span className="text-esi-text-secondary">
                <strong className="text-esi-text-primary">{regionName(region.slugs)}</strong>
                {" — شدت حجم "}
                <span className="tabular-nums">{Math.round(value)}</span>
                {" از ۱۰۰"}
              </span>
            );
          })()
        ) : (
          <span className="text-esi-text-muted text-xs">برای جزئیات، ناحیه‌ای را لمس یا با Tab انتخاب کنید</span>
        )}
      </div>

      {/* Non-visual equivalent list (a11y + text-first rule) */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-esi-text-secondary hover:text-esi-text-primary">فهرست متنی عضلات و شدت تمرین</summary>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(intensity).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([slug, v]) => (
            <li key={slug} className="flex items-center justify-between gap-4 text-esi-text-secondary">
              <span>{MUSCLE_GROUPS.find((m) => m.slug === slug)?.nameFa ?? slug}</span>
              <span className="tabular-nums text-esi-text-muted">{Math.round(v)}</span>
            </li>
          ))}
          {Object.values(intensity).every((v) => !v) && (
            <li className="text-esi-text-muted">داده کافی برای نقشه عضلات موجود نیست — با ثبت تمرین‌ها نقشه شکل می‌گیرد.</li>
          )}
        </ul>
      </details>
    </div>
  );
}
