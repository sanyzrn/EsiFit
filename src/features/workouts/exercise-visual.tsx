"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { exerciseVisualFor } from "@/features/workouts/data/exercise-media";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Existing licensed stills, sequenced for coaching; no invented intermediate poses. */
export function ExerciseVisual({
  slug,
  name,
  compact = false,
  autoPlay = false,
  playing = true,
  immersive = false,
  instructions,
  className,
}: {
  slug: string;
  name: string;
  compact?: boolean;
  autoPlay?: boolean;
  playing?: boolean;
  immersive?: boolean;
  instructions?: string;
  className?: string;
}) {
  const media = exerciseVisualFor(slug);
  const reduce = useReducedMotion();
  const [pose, setPose] = React.useState<"start" | "finish">("start");
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState({ start: false, finish: false });
  const [loop, setLoop] = React.useState(autoPlay);
  const [speed, setSpeed] = React.useState(1);
  React.useEffect(() => {
    setPose("start");
    setFailed(false);
    setLoaded({ start: false, finish: false });
  }, [slug]);
  const twoPoses = Boolean(media?.finish);
  const cycling =
    !compact &&
    loop &&
    playing &&
    !reduce &&
    twoPoses &&
    loaded.start &&
    loaded.finish &&
    !failed;
  React.useEffect(() => {
    if (!cycling) return;
    const timer = window.setInterval(
      () => setPose((value) => (value === "start" ? "finish" : "start")),
      1000 / speed,
    );
    return () => window.clearInterval(timer);
  }, [cycling, speed]);

  if (!media || failed) {
    if (compact) return null;
    return (
      <figure
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-1 p-6 text-center",
          immersive && "min-h-64 flex-1",
          className,
        )}
      >
        <Icon name="Dumbbell" size={48} className="mb-4 text-primary" />
        <figcaption className="max-w-md">
          <p className="text-sm font-bold">{name}</p>
          <p className="mt-3 text-sm leading-7 text-esi-text-secondary">
            {instructions ||
              "تصویر آموزشی این حرکت در دسترس نیست. از بخش جزئیات، راهنمای حرکت را ببین."}
          </p>
          {failed && (
            <button
              type="button"
              onClick={() => {
                setLoaded({ start: false, finish: false });
                setFailed(false);
              }}
              className="mt-4 min-h-11 text-xs font-bold text-primary"
            >
              تلاش دوباره برای تصویر
            </button>
          )}
        </figcaption>
      </figure>
    );
  }
  const image = (frame: "start" | "finish", src: string) => (
    // Licensed RepDB images are displayed unchanged, retaining visible attribution.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={`${slug}-${frame}`}
      src={src}
      alt={`نمای آموزشی ${name}، حالت ${frame === "start" ? "شروع" : "پایان"}`}
      loading={immersive ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded((value) => ({ ...value, [frame]: true }))}
      onError={() => setFailed(true)}
      aria-hidden={frame !== pose}
      className={cn(
        "absolute inset-0 h-full w-full object-contain",
        frame !== pose && "invisible",
      )}
    />
  );
  if (compact)
    return (
      <span
        className={cn(
          "relative block aspect-square w-[88px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2",
          className,
        )}
      >
        {image("start", media.start)}
      </span>
    );
  return (
    <figure
      className={cn(
        "flex w-full flex-col overflow-hidden",
        immersive
          ? "min-h-0 flex-1"
          : "rounded-2xl border border-border bg-surface-2",
        className,
      )}
    >
      <div
        className={cn(
          "relative mx-auto w-full overflow-hidden",
          immersive ? "min-h-40 flex-1" : "aspect-square max-w-[310px]",
        )}
      >
        {image("start", media.start)}
        {media.finish && image("finish", media.finish)}
      </div>
      <figcaption
        className={cn(
          "flex shrink-0 flex-col gap-2 p-3",
          !immersive && "border-t border-border",
        )}
      >
        {twoPoses && (
          <div
            className="flex items-center justify-center gap-2"
            role="group"
            aria-label="پخش آموزشی حرکت"
          >
            <button
              type="button"
              aria-pressed={loop && !reduce}
              onClick={() => setLoop((value) => !value)}
              disabled={Boolean(reduce)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-xs font-bold disabled:opacity-50"
            >
              <Icon name={loop && !reduce ? "Pause" : "Play"} size={15} />
              {loop && !reduce ? "پخش خودکار" : "نمایش دستی"}
            </button>
            <button
              type="button"
              onClick={() => {
                setLoop(false);
                setPose((value) => (value === "start" ? "finish" : "start"));
              }}
              className="min-h-11 rounded-xl bg-surface-2 px-3 text-xs font-bold"
            >
              {pose === "start" ? "حالت پایان" : "حالت شروع"}
            </button>
            <button
              type="button"
              aria-label={`سرعت نمایش ${speed} برابر`}
              onClick={() =>
                setSpeed((value) =>
                  value === 1 ? 0.5 : value === 0.5 ? 1.5 : 1,
                )
              }
              className="min-h-11 min-w-11 rounded-xl bg-surface-2 px-2 text-xs tabular-nums"
              dir="ltr"
            >
              {speed}×
            </button>
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
    </figure>
  );
}
