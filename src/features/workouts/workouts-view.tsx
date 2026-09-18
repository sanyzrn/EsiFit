"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { ExerciseCard } from "@/features/workouts/exercise-card";
import { AnatomyExplorer } from "@/components/data-viz/anatomy/anatomy-explorer";
import type { BodySlug } from "@/components/data-viz/anatomy/muscle-body";
import { MUSCLE_GROUP_TO_BODY, BODY_SLUG_FA } from "@/components/data-viz/anatomy/muscle-mapping";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type PlanExercise = {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rest: number;
  note: string;
  muscles: string[];
};

type LibraryExercise = {
  id: string;
  name: string;
  equipment: string;
  pattern: string;
  difficulty: string;
  instructions: string;
  muscles: Array<{ name: string; slug?: string; role: string; intensity: number }>;
};

type Alternative = {
  exerciseId: string;
  nameFa: string;
  equipment: string;
  difficulty: string;
  score: number;
  reasonsFa: string[];
};

const EQUIPMENT_FA: Record<string, string> = {
  barbell: "هالتر", dumbbell: "دمبل", machine: "دستگاه", cable: "سیم‌کش",
  bodyweight: "وزن بدن", kettlebell: "کتل‌بل", band: "کش", cardio: "کاردیو",
};

const DIFFICULTY_FA: Record<string, string> = {
  beginner: "مبتدی", intermediate: "متوسط", advanced: "پیشرفته",
};

export function WorkoutsView({
  planDay,
  activePlanName,
  exercises,
}: {
  planDay: { id: string; name: string; isRest: boolean; exercises: PlanExercise[] } | null;
  activePlanName: string | null;
  exercises: LibraryExercise[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [equipment, setEquipment] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<LibraryExercise | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [anatomyOpen, setAnatomyOpen] = React.useState(false);
  const [selectedMuscles, setSelectedMuscles] = React.useState<Set<BodySlug>>(new Set());
  const [alternatives, setAlternatives] = React.useState<Alternative[] | null>(null);
  const [altsLoading, setAltsLoading] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const reduce = useReducedMotion();
  const { toast } = useToast();

  const regeneratePlan = async () => {
    setRegenerating(true);
    try {
      const res = await api<{ message?: string }>("/api/workouts/plan/regenerate", {
        method: "POST",
        json: { template: "ppl" },
      });
      toast({ title: "برنامه بازسازی شد", description: res.message ?? "برنامه ۴ هفته‌ای جدید فعال شد." });
      router.refresh();
    } catch (e) {
      toast({ title: "بازسازی ناموفق", description: errorMessage(e), variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const loadAlternatives = async (exerciseId: string) => {
    // Toggle closed when already showing this exercise's alternatives.
    if (alternatives) {
      setAlternatives(null);
      return;
    }
    setAltsLoading(true);
    setAlternatives(null);
    try {
      const d = await api<{ alternatives: Alternative[] }>(`/api/workouts/alternatives?exerciseId=${encodeURIComponent(exerciseId)}`);
      setAlternatives(d.alternatives);
    } catch (e) {
      setAlternatives([]);
      toast({ title: "جایگزین‌ها بارگذاری نشد", description: errorMessage(e) });
    } finally {
      setAltsLoading(false);
    }
  };

  const equipmentOptions = React.useMemo(
    () => ["all", ...Array.from(new Set(exercises.map((e) => e.equipment)))],
    [exercises],
  );

  const filtered = exercises.filter(
    (e) =>
      (equipment === "all" || e.equipment === equipment) &&
      (!query.trim() || e.name.includes(query.trim()) || e.muscles.some((m) => m.name.includes(query.trim()))) &&
      (selectedMuscles.size === 0 ||
        e.muscles.some((m) => {
          const body = m.slug ? MUSCLE_GROUP_TO_BODY[m.slug] : undefined;
          return body && selectedMuscles.has(body);
        })),
  );

  const startToday = async () => {
    setStarting(true);
    try {
      const data = await api<{ ok: boolean; session: { id: string } }>(
        "/api/workouts/sessions",
        {
          method: "POST",
          json: planDay ? { planDayId: planDay.id } : {},
        },
      );
      if (data.session?.id) router.push(`/workout/live?session=${data.session.id}`);
      else toast({ title: "جلسه ساخته نشد", description: "دوباره تلاش کنید." });
    } catch (e) {
      toast({
        title: "شروع تمرین ناموفق بود",
        description: errorMessage(e),
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <PageHeader
        title="تمرین"
        description={activePlanName ?? "برنامه فعال ندارید — از حرکات پایین جلسه دلخواه بسازید"}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-11" onClick={() => void regeneratePlan()} disabled={regenerating}>
              {regenerating ? "…" : "بازسازی برنامه"}
            </Button>
            <Button className="h-11 esi-glow" onClick={() => void startToday()} disabled={starting}>
              {starting ? "…" : "شروع سریع تمرین"}
            </Button>
          </div>
        }
      />

      {/* Today plan */}
      {planDay && (
        <section aria-label="برنامه امروز" className="px-4 lg:px-8 mb-8">
          <div className="rounded-3xl border border-border bg-surface-1 p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-primary">برنامه امروز</p>
                <h2 className="text-lg font-bold mt-1">{planDay.name}</h2>
              </div>
              <Button onClick={() => void startToday()} disabled={starting} className="h-10">
                شروع
              </Button>
            </div>
            <ol className="space-y-2">
              {planDay.exercises.map((e, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
                  <span className="h-7 w-7 shrink-0 rounded-full bg-surface-3 flex items-center justify-center text-xs font-bold tabular-nums">
                    {toPersianDigits(i + 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-[11px] text-esi-text-muted mt-0.5">
                      {toPersianDigits(e.sets)} ست × {toPersianDigits(e.repsMin)}–{toPersianDigits(e.repsMax)} • استراحت {toPersianDigits(e.rest)} ثانیه
                      {e.muscles.length > 0 ? ` • ${e.muscles[0]}` : ""}
                    </p>
                  </div>
                  {e.note && <span className="text-[11px] text-esi-text-muted hidden sm:block">{e.note}</span>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Anatomy selector */}
      <section aria-label="انتخاب عضله با آناتومی" className="px-4 lg:px-8 mb-6">
        <div className="rounded-3xl border border-border bg-surface-1 overflow-hidden">
          <button
            type="button"
            onClick={() => setAnatomyOpen((v) => !v)}
            aria-expanded={anatomyOpen}
            className="w-full flex items-center justify-between gap-3 px-6 py-4 text-start"
          >
            <span>
              <span className="font-bold flex items-center gap-2">
                <Icon name="PersonStanding" size={18} className="text-primary" />
                آناتومی تعاملی
              </span>
              <span className="text-xs text-esi-text-secondary mt-0.5 block">
                عضله را روی بدن انتخاب کنید تا حرکات مربوط به آن فیلتر شود
              </span>
            </span>
            <motion.span animate={{ rotate: anatomyOpen ? 180 : 0 }} transition={{ duration: reduce ? 0 : 0.25 }} aria-hidden>
              <Icon name="ChevronDown" size={18} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {anatomyOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0">
                  <AnatomyExplorer
                    selected={selectedMuscles}
                    onChange={setSelectedMuscles}
                    height={300}
                  />
                  {selectedMuscles.size > 0 && (
                    <p className="mt-3 text-xs text-esi-text-secondary text-center">
                      {toPersianDigits(filtered.length)} حرکت برای{" "}
                      {[...selectedMuscles].map((s) => BODY_SLUG_FA[s]).join("، ")} پیدا شد
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Library */}
      <section aria-label="کتابخانه حرکات" className="px-4 lg:px-8 pb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold">
            کتابخانه حرکات ({toPersianDigits(filtered.length)}
            {selectedMuscles.size > 0 || equipment !== "all" || query.trim() ? ` از ${toPersianDigits(exercises.length)}` : ""})
          </h2>
          {(selectedMuscles.size > 0 || equipment !== "all" || query.trim()) && (
            <button
              type="button"
              onClick={() => {
                setSelectedMuscles(new Set());
                setEquipment("all");
                setQuery("");
              }}
              className="text-xs text-primary hover:underline"
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Icon name="Search" size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-esi-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی حرکت یا عضله…"
              className="ps-10 h-11"
              aria-label="جستجوی حرکت"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="فیلتر تجهیزات">
            {equipmentOptions.map((eq) => (
              <button
                key={eq}
                role="tab"
                aria-selected={equipment === eq}
                onClick={() => setEquipment(eq)}
                className={
                  equipment === eq
                    ? "shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground min-h-9"
                    : "shrink-0 rounded-full bg-surface-2 px-4 py-2 text-xs text-esi-text-secondary min-h-9"
                }
              >
                {eq === "all" ? "همه" : EQUIPMENT_FA[eq] ?? eq}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} onOpen={() => setSelected(ex)} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-esi-text-muted">حرکتی با این مشخصات پیدا نشد.</p>
        )}
      </section>

      {/* Exercise detail sheet */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={selected.name}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-surface-1 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-xl font-bold">{selected.name}</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="بستن"
                className="h-10 w-10 rounded-full bg-surface-2 flex items-center justify-center"
              >
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="neutral">{EQUIPMENT_FA[selected.equipment] ?? selected.equipment}</Badge>
              <Badge variant="neutral">{DIFFICULTY_FA[selected.difficulty] ?? selected.difficulty}</Badge>
              {selected.muscles.filter((m) => m.role === "primary").map((m) => (
                <Badge key={m.name} variant="success">{m.name}</Badge>
              ))}
              {selected.muscles.filter((m) => m.role === "secondary").map((m) => (
                <Badge key={m.name} variant="neutral">{m.name}</Badge>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-esi-text-secondary">{selected.instructions}</p>

            {/* Smart alternatives */}
            <div className="mt-5 rounded-2xl border border-border p-4">
              <button
                type="button"
                onClick={() => void loadAlternatives(selected.id)}
                className="w-full flex items-center justify-between gap-2 text-start"
              >
                <span className="text-sm font-bold flex items-center gap-2">
                  <Icon name="Shuffle" size={15} className="text-primary" />
                  جایگزین‌های هوشمند
                </span>
                <span className="text-[11px] text-primary">{alternatives ? "بستن" : "نمایش"}</span>
              </button>
              {altsLoading && <div className="mt-3 h-16 rounded-xl bg-surface-2 animate-pulse" />}
              {alternatives && (
                <ul className="mt-3 space-y-2">
                  {alternatives.slice(0, 4).map((alt) => (
                    <li key={alt.exerciseId} className="rounded-xl bg-surface-2 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold truncate">{alt.nameFa}</p>
                        <span className="text-[10px] tabular-nums text-esi-text-muted shrink-0">
                          {toPersianDigits(Math.round(alt.score * 100))}٪
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {alt.reasonsFa.map((r) => (
                          <span key={r} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                            {r}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                  {alternatives.length === 0 && (
                    <li className="py-2 text-center text-xs text-esi-text-muted">گزینه‌ای با این شرایط پیدا نشد</li>
                  )}
                </ul>
              )}
              <p className="mt-2 text-[10px] text-esi-text-muted leading-4">
                پیشنهادها بر اساس عضلات مشترک، الگوی حرکتی و درد گزارش‌شده شما رتبه‌بندی می‌شوند.
              </p>
            </div>

            <Button asChild className="mt-6 w-full h-11">
              <a href={`/workout/live`}>شروع تمرین</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
