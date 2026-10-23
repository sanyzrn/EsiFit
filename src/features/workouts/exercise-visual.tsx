"use client";

import * as React from "react";
import { exerciseVisualFor } from "@/features/workouts/data/exercise-media";
import { cn } from "@/lib/utils";

/** Illustrations licensed by RepDB Free Tier, separate from the openGym reference. */
export function ExerciseVisual({
  slug, name, compact = false, className,
}: {
  slug: string;
  name: string;
  compact?: boolean;
  className?: string;
}) {
  const media = exerciseVisualFor(slug);
  const [pose, setPose] = React.useState<"start" | "finish">("start");
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setPose("start"); setFailed(false); }, [slug]);
  if (!media || failed) return null;
  const twoPoses = Boolean(media.finish);
  const src = pose === "finish" && media.finish ? media.finish : media.start;

  return (
    <figure className={cn(
      "overflow-hidden rounded-2xl border border-border bg-surface-2",
      compact ? "w-[88px] shrink-0" : "w-full",
      className,
    )}>
      <div className={cn("relative overflow-hidden", compact ? "aspect-square" : "mx-auto max-w-[310px] aspect-square")}>
        {/* RepDB flat artwork is explicitly licensed for in-app use.
            Do not feed images into generative models or use their premium samples. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`نمای آموزشی ${name}، حالت ${pose === "start" ? "شروع" : "پایان"}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      </div>
      {!compact && (
        <figcaption className="flex flex-col gap-2 border-t border-border p-3">
          {twoPoses && (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="حالت‌های حرکت">
              {(["start", "finish"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPose(p)}
                  aria-pressed={pose === p}
                  className={cn(
                    "min-h-10 rounded-xl text-xs font-bold transition-colors",
                    pose === p ? "bg-primary text-primary-foreground" : "bg-surface-3 text-esi-text-secondary",
                  )}
                >
                  {p === "start" ? "حالت شروع" : "حالت پایان"}
                </button>
              ))}
            </div>
          )}
          <a
            href="https://repdb.co"
            target="_blank"
            rel="noopener noreferrer"
            className="self-center text-[10px] text-esi-text-muted hover:text-primary"
          >
            Exercise data by RepDB (repdb.co)
          </a>
        </figcaption>
      )}
    </figure>
  );
}
