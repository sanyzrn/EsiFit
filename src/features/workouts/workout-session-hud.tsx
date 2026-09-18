"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage, isApiError } from "@/lib/client/api";
import { enqueueOperation, newClientId, syncQueue } from "@/lib/offline/adapter";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { formatClock, parseLocaleNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * WorkoutSessionHUD — Live Workout Mode (DESIGN_BIBLE §8: session minimalism).
 * Only current exercise, set entry, rest timer and essential actions.
 * Offline-first: every set is written to the IndexedDB queue BEFORE the
 * network attempt — an active workout survives any connectivity loss.
 */

export type LiveExercise = {
  exerciseId: string;
  name: string;
  slug: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRpe: number;
  restSeconds: number;
  note: string;
  sets?: Array<{ id?: string; setNumber: number; weightKg: number | null; reps: number | null; rpe?: number | null; isPr?: boolean }>;
};

export type LiveSession = {
  id: string;
  name: string;
  startedAt: string;
  planDayId?: string | null;
  exercises: LiveExercise[];
  exerciseLogs?: Array<{ exerciseId: string; sets: Array<{ id: string; setNumber: number; weightKg: number | null; reps: number | null; rpe: number | null; isPr: boolean }> }>;
};

type SwapAlternative = {
  exerciseId: string;
  nameFa: string;
  equipment: string;
  difficulty: string;
  score: number;
  reasonsFa: string[];
};

const PAIN_REGION_FA: Record<string, string> = {
  lower_back: "کمر پایین", shoulder: "سرشانه", knee: "زانو", elbow: "آرنج",
  wrist: "مچ", hip: "لگن", ankle: "قوزک پا", neck: "گردن", groin: "کشاله ران",
  ribs: "دنده", other: "سایر",
};

export type CompleteSummary = {
  volume: number;
  durationMinutes: number;
  setCount: number;
  prs: Array<{ exerciseName: string; value: number; unit: string }>;
  xpAwarded: number;
  newBadges: string[];
};

export function WorkoutSessionHUD({
  initialSession,
}: {
  initialSession: LiveSession;
}) {
  const reduced = useReducedMotion();
  const voiceFlag = useFeatureFlag("VOICE_LOGGING");
  const swapFlag = useFeatureFlag("EXERCISE_SWAP");
  const [session, setSession] = React.useState<LiveSession>(() => hydrateSets(initialSession));
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [weight, setWeight] = React.useState("");
  const [reps, setReps] = React.useState("");
  const [rpe, setRpe] = React.useState<number | null>(null);
  const [rest, setRest] = React.useState<{ remaining: number; total: number } | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const [summary, setSummary] = React.useState<CompleteSummary | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [startedAt] = React.useState(() => new Date(initialSession.startedAt).getTime());
  const [elapsed, setElapsed] = React.useState(0);
  const [listening, setListening] = React.useState(false);
  const [swapOpen, setSwapOpen] = React.useState(false);
  const [alternatives, setAlternatives] = React.useState<SwapAlternative[] | null>(null);
  const [swapLoading, setSwapLoading] = React.useState(false);
  const [swapError, setSwapError] = React.useState<string | null>(null);
  const [painRegions, setPainRegions] = React.useState<string[]>([]);
  const [loggedVersion, setLoggedVersion] = React.useState(0);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [library, setLibrary] = React.useState<Array<{ id: string; nameFa: string; equipment: string }>>([]);
  const [pickerQuery, setPickerQuery] = React.useState("");

  // ---- elapsed clock ----
  React.useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // ---- rest timer ----
  React.useEffect(() => {
    if (!rest || rest.remaining <= 0) return;
    const t = setTimeout(() => {
      setRest((r) => (r ? { ...r, remaining: r.remaining - 1 } : r));
    }, 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const exercise = session.exercises[currentIdx];
  const loggedSets = React.useMemo(() => {
    const fromServer = session.exerciseLogs?.find((l) => l.exerciseId === exercise?.exerciseId)?.sets ?? [];
    const local = exercise?.sets ?? [];
    const map = new Map<number, { setNumber: number; weightKg: number | null; reps: number | null; rpe?: number | null; isPr?: boolean }>();
    for (const s of [...fromServer, ...local]) map.set(s.setNumber, s);
    return [...map.values()].sort((a, b) => a.setNumber - b.setNumber);
  }, [session, exercise, loggedVersion]);
  const nextSetNumber = (loggedSets[loggedSets.length - 1]?.setNumber ?? 0) + 1;
  const isLastExercise = currentIdx === session.exercises.length - 1;
  // Free sessions (no plan day) can grow mid-workout via the library picker.
  const isFreeSession = !("planDayId" in initialSession) || initialSession.planDayId == null;

  const openPicker = async () => {
    setPickerOpen(true);
    if (library.length === 0) {
      try {
        const d = await api<{ exercises: Array<{ id: string; nameFa: string; equipment: string }> }>("/api/workouts/exercises");
        setLibrary(d.exercises);
      } catch {
        setLibrary([]);
      }
    }
  };

  const addExercise = async (exerciseId: string) => {
    try {
      const d = await api<{ exercise: LiveExercise }>(`/api/workouts/sessions/${session.id}/add-exercise`, {
        method: "POST",
        json: { exerciseId },
      });
      const nextLen = session.exercises.length + 1;
      setSession((prev) => ({ ...prev, exercises: [...prev.exercises, d.exercise] }));
      setCurrentIdx(nextLen - 1); // jump to the newly added exercise
      setPickerOpen(false);
      setPickerQuery("");
    } catch (e) {
      setError(isApiError(e) ? errorMessage(e) : "افزودن حرکت ممکن نشد.");
    }
  };

  const openSwap = async () => {
    setSwapOpen(true);
    setSwapLoading(true);
    setAlternatives(null);
    try {
      const d = await api<{ alternatives: SwapAlternative[]; painRegions: string[] }>(
        `/api/workouts/alternatives?exerciseId=${encodeURIComponent(exercise?.exerciseId ?? "")}`,
      );
      setAlternatives(d.alternatives);
      setPainRegions(d.painRegions);
    } catch {
      setAlternatives([]);
    } finally {
      setSwapLoading(false);
    }
  };

  const doSwap = async (targetId: string, reason: "pain_limitation" | "preference" | "equipment" | "difficulty" | "unavailable" | "other") => {
    if (!exercise) return;
    setSwapLoading(true);
    try {
      const d = await api<{ log: { id: string; exerciseId: string; name: string; slug: string; targetSets: number; targetRepsMin: number; targetRepsMax: number; targetRpe: number; restSeconds: number; note: string } }>(
        "/api/workouts/swap",
        { method: "POST", json: { sessionId: session.id, exerciseId: exercise.exerciseId, targetExerciseId: targetId, reason } },
      );
      setSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((ex, i) =>
          i === currentIdx
            ? {
                ...ex,
                exerciseId: d.log.exerciseId,
                name: d.log.name,
                slug: d.log.slug,
                sets: [],
              }
            : ex,
        ),
      }));
      setLoggedVersion((v) => v + 1);
      setSwapOpen(false);
      setAlternatives(null);
    } catch (e) {
      setSwapError(isApiError(e) ? errorMessage(e) : "جایگزینی ممکن نشد.");
    } finally {
      setSwapLoading(false);
    }
  };

  // Prefill from last set (frictionless capture) — includes optimistic local
  // sets so the next entry keeps weight/reps after an offline log.
  React.useEffect(() => {
    const last = loggedSets[loggedSets.length - 1];
    setWeight(last?.weightKg != null ? String(last.weightKg) : "");
    setReps(last?.reps != null ? String(last.reps) : "");
    setRpe(null);
  }, [currentIdx, loggedSets]);

  const logSet = async () => {
    if (!exercise) return;
    const w = parseLocaleNumber(weight);
    const r = parseLocaleNumber(reps);
    if (w == null && r == null) {
      setError("وزن یا تکرار را وارد کنید.");
      return;
    }
    setError(null);
    const clientId = newClientId("set");
    const payload = {
      clientId,
      sessionId: session.id,
      exerciseId: exercise.exerciseId,
      orderIndex: currentIdx,
      setNumber: nextSetNumber,
      weightKg: w,
      reps: r != null ? Math.round(r) : null,
      rpe: rpe ?? undefined,
      completedAt: new Date().toISOString(),
    };

    // 1) Local-first optimistic state
    setSession((s) => ({
      ...s,
      exercises: s.exercises.map((ex, i) =>
        i === currentIdx
          ? {
              ...ex,
              sets: [...(ex.sets ?? []), { setNumber: nextSetNumber, weightKg: w, reps: r != null ? Math.round(r) : null, rpe }],
            }
          : ex,
      ),
    }));

    // 2) Offline-safe queue BEFORE network
    await enqueueOperation({ clientId, kind: "workout_set", endpoint: "/api/workouts/sync", payload });

    // 3) Best-effort immediate sync (queue replays on reconnect anyway)
    void syncQueue();

    // 4) Rest timer (planned restSeconds)
    if (exercise.restSeconds > 0) {
      setRest({ remaining: exercise.restSeconds, total: exercise.restSeconds });
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await syncQueue();
      const res = await api<{ summary: CompleteSummary }>("/api/workouts/complete", {
        method: "POST",
        json: { sessionId: session.id, durationSeconds: elapsed },
      });
      setSummary(res.summary);
      setCompleted(true);
    } catch (e) {
      if (isApiError(e) && e.code === "network") {
        // Offline: keep session active; completion retries later — never lose the workout.
        setError("آفلاین هستید — جلسه حفظ شد. با اتصال دوباره، پایان تمرین را بزنید.");
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- Voice logging (graceful) ----
  const startVoice = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike });
    const Ctor = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "fa-IR";
    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      const numbers = text.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).match(/\d+/g);
      if (numbers && numbers.length >= 1) setWeight(numbers[0]);
      if (numbers && numbers.length >= 2) setReps(numbers[1]);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  if (completed) {
    return <WorkoutCompleteSummary sessionName={session.name} summary={summary} />;
  }

  if (!exercise) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold">تمرین آزاد خالی است</p>
        <p className="text-sm text-esi-text-secondary">یک حرکت از کتابخانه اضافه کنید یا برنامه‌ای انتخاب کنید.</p>
        <div className="flex gap-3">
          <Button className="esi-glow" onClick={() => void openPicker()}>
            <span className="flex items-center gap-1.5">
              <Icon name="Plus" size={15} />
              افزودن حرکت
            </span>
          </Button>
          <Button asChild variant="secondary"><a href="/workouts">کتابخانه تمرین</a></Button>
        </div>
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center"
              onClick={() => setPickerOpen(false)}
            >
              <PickerSheet
                library={library}
                loading={library.length === 0}
                query={pickerQuery}
                setQuery={setPickerQuery}
                onAdd={(id) => void addExercise(id)}
                onClose={() => setPickerOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col safe-top safe-bottom">
      {/* ---- Top bar: session meta ---- */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-esi-text-muted shrink-0">{toPersianDigits(currentIdx + 1)}/{toPersianDigits(session.exercises.length)}</span>
          <p className="text-sm font-semibold truncate">{session.name}</p>
        </div>
        <div className="flex items-center gap-3 text-sm tabular-nums text-esi-text-secondary">
          <span className="flex items-center gap-1.5">
            <Icon name="Timer" size={16} />
            {formatClock(elapsed)}
          </span>
          <button
            type="button"
            onClick={() => void finish()}
            disabled={busy}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
          >
            پایان تمرین
          </button>
        </div>
      </header>

      {/* ---- Exercise strip ---- */}
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="حرکات جلسه">
          {isFreeSession && (
            <button
              type="button"
              onClick={() => void openPicker()}
              className="shrink-0 rounded-full border border-dashed border-primary/50 px-3.5 py-2 text-xs font-bold text-primary min-h-9 transition-colors hover:bg-primary/10 active:scale-95"
            >
              <span className="flex items-center gap-1">
                <Icon name="Plus" size={13} />
                حرکت
              </span>
            </button>
          )}
          {session.exercises.map((ex, i) => {
            const done = (i < currentIdx) || (ex.sets?.length ?? 0) >= ex.targetSets && i === currentIdx;
            return (
              <button
                key={ex.exerciseId}
                role="tab"
                aria-selected={i === currentIdx}
                onClick={() => setCurrentIdx(i)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs whitespace-nowrap transition-colors min-h-9",
                  i === currentIdx ? "bg-primary text-primary-foreground font-bold" :
                  done ? "bg-surface-3 text-esi-text-secondary" : "bg-surface-2 text-esi-text-muted",
                )}
              >
                {ex.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Current exercise + set entry ---- */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold">{exercise.name}</h2>
                <p className="mt-1 text-sm text-esi-text-secondary">
                  هدف: {toPersianDigits(exercise.targetSets)} ست × {toPersianDigits(exercise.targetRepsMin)}–{toPersianDigits(exercise.targetRepsMax)} تکرار
                  {exercise.note ? ` • ${exercise.note}` : ""}
                </p>
              </div>
              {swapFlag && loggedSets.length === 0 && (
                <button
                  type="button"
                  onClick={() => void openSwap()}
                  className="shrink-0 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-esi-text-secondary transition-colors hover:text-primary hover:border-primary/40 active:scale-95"
                >
                  <span className="flex items-center gap-1.5">
                    <Icon name="Shuffle" size={13} />
                    جایگزینی
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* set list */}
          <div className="space-y-2">
            {loggedSets.length === 0 && (
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-xs text-esi-text-muted">اولین ست را ثبت کنید</p>
            )}
            {loggedSets.map((s, i) => (
              <motion.div
                key={`${s.setNumber}-${i}`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  s.isPr ? "border-amber-400/50 bg-amber-400/8" : "border-border bg-surface-1",
                )}
              >
                <span className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center text-xs font-bold tabular-nums shrink-0">
                  {toPersianDigits(s.setNumber)}
                </span>
                <span className="flex-1 tabular-nums text-sm">
                  {s.weightKg != null ? `${toPersianDigits(s.weightKg)} کیلو` : "وزن بدن"}
                  {s.reps != null ? ` × ${toPersianDigits(s.reps)}` : ""}
                  {s.rpe != null ? <span className="text-esi-text-muted"> • RPE {toPersianDigits(s.rpe)}</span> : null}
                </span>
                {s.isPr && <span className="text-xs font-bold text-amber-400">رکورد!</span>}
              </motion.div>
            ))}
          </div>

          {/* set entry — thumb-reachable */}
          <div className="sticky bottom-0 rounded-3xl border border-border bg-surface-1 p-4 shadow-[var(--shadow-float)] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberPadInput
                label="وزن (کیلوگرم)"
                value={weight}
                onChange={setWeight}
                step={2.5}
              />
              <NumberPadInput
                label="تکرار"
                value={reps}
                onChange={setReps}
                step={1}
                integer
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-esi-text-muted shrink-0">RPE:</span>
              {[6.5, 7.5, 8.5, 9.5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRpe(rpe === v ? null : v)}
                  aria-pressed={rpe === v}
                  className={cn(
                    "min-h-9 flex-1 rounded-lg text-xs font-medium tabular-nums transition-colors",
                    rpe === v ? "bg-blue-500 text-white" : "bg-surface-2 text-esi-text-secondary",
                  )}
                >
                  {toPersianDigits(v)}
                </button>
              ))}
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button className="flex-1 h-12 text-base font-bold" onClick={() => void logSet()}>
                ثبت ست {toPersianDigits(nextSetNumber)}
              </Button>
              {voiceFlag && typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) && (
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn("h-12 w-12 shrink-0", listening && "esi-pulse text-primary")}
                  onClick={startVoice}
                  aria-label="ثبت صوتی وزن و تکرار"
                >
                  <Icon name="Mic" size={20} />
                </Button>
              )}
            </div>
          </div>

          {/* next exercise preview */}
          {!isLastExercise && (
            <p className="text-center text-xs text-esi-text-muted pb-4">
              حرکت بعد: <strong className="text-esi-text-secondary">{session.exercises[currentIdx + 1].name}</strong>
            </p>
          )}
        </div>
      </div>

      {/* ---- Rest timer overlay ---- */}
      <AnimatePresence>
        {rest && rest.remaining > 0 && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute bottom-0 inset-x-0 z-10 border-t border-primary/30 esi-glass backdrop-blur-md"
            role="timer"
            aria-label={`استراحت: ${rest.remaining} ثانیه باقی مانده`}
          >
            <div className="mx-auto max-w-lg px-4 py-4 flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 64 64" className="-rotate-90">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-3)" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="26" fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={163.4}
                    strokeDashoffset={163.4 * (1 - rest.remaining / rest.total)}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
                  {toPersianDigits(rest.remaining)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">استراحت</p>
                <p className="text-xs text-esi-text-secondary mt-0.5">
                  بعدی: {nextSetNumber <= exercise.targetSets ? `ست ${toPersianDigits(nextSetNumber)} همین حرکت` : session.exercises[currentIdx + 1]?.name ?? "پایان تمرین"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRest((r) => (r ? { ...r, remaining: r.remaining + 30, total: r.total + 30 } : r))}
                  className="min-h-11 min-w-11 rounded-full bg-surface-2 text-sm font-bold tabular-nums"
                  aria-label="۳۰ ثانیه اضافه"
                >
                  +۳۰
                </button>
                <button
                  type="button"
                  onClick={() => setRest(null)}
                  className="min-h-11 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
                >
                  رد کردن
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Exercise picker (free sessions) ---- */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center"
            onClick={() => setPickerOpen(false)}
          >
            <PickerSheet
              library={library}
              loading={library.length === 0}
              query={pickerQuery}
              setQuery={setPickerQuery}
              onAdd={(id) => void addExercise(id)}
              onClose={() => setPickerOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Smart swap sheet ---- */}
      <AnimatePresence>
        {swapOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center"
            onClick={() => setSwapOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="جایگزینی هوشمند حرکت"
          >
            <motion.div
              initial={reduced ? false : { y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[80dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-surface-1 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Icon name="Shuffle" size={17} className="text-primary" />
                  جایگزین‌های «{exercise?.name}»
                </h3>
                <button type="button" onClick={() => setSwapOpen(false)} aria-label="بستن" className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center">
                  <Icon name="X" size={16} />
                </button>
              </div>

              {painRegions.length > 0 && (
                <p className="rounded-xl bg-destructive/8 border border-destructive/25 px-3 py-2 text-[11px] text-destructive">
                  با توجه به درد فعال ({painRegions.map((r) => PAIN_REGION_FA[r] ?? r).join("، ")})، حرکات پرریسک فیلتر شده‌اند.
                </p>
              )}

              {swapError && (
                <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{swapError}</p>
              )}

              {swapLoading && !alternatives && <div className="h-40 rounded-2xl bg-surface-2 animate-pulse" />}

              {alternatives && (
                <ul className="space-y-2">
                  {alternatives.slice(0, 5).map((alt) => (
                    <li key={alt.exerciseId} className="rounded-2xl bg-surface-2 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate">{alt.nameFa}</p>
                        <button
                          type="button"
                          onClick={() => void doSwap(alt.exerciseId, "preference")}
                          disabled={swapLoading}
                          className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
                        >
                          انتخاب
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alt.reasonsFa.map((r) => (
                          <span key={r} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">{r}</span>
                        ))}
                      </div>
                    </li>
                  ))}
                  {alternatives.length === 0 && (
                    <li className="py-6 text-center text-sm text-esi-text-muted">جایگزین امنی با این شرایط پیدا نشد</li>
                  )}
                </ul>
              )}

              {/* Pain quick-report */}
              <div className="rounded-2xl border border-dashed border-border p-3.5">
                <p className="text-xs font-bold mb-2">این حرکت درد ایجاد می‌کند؟</p>
                <div className="flex flex-wrap gap-1.5">
                  {["shoulder", "knee", "lower_back", "elbow", "wrist"].map((region) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => void reportPain(region)}
                      className="rounded-full bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-esi-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      {PAIN_REGION_FA[region]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-esi-text-muted leading-4">
                  ثبت درد، حرکات پرریسک را از پیشنهادها و برنامه‌های آینده حذف می‌کند. تشخیص پزشکی نیست.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Quick pain report (privacy-sensitive; powers the swap filter). */
async function reportPain(region: string): Promise<void> {
  try {
    await api("/api/pain-reports", { method: "POST", json: { bodyRegion: region, severity: 5, note: "ثبت‌شده از تمرین زنده" } });
  } catch {
    // Silent best-effort; the sheet stays open for retry via library flows.
  }
}

/** Hydrate server logs into the exercise.sets shape (defensive against missing fields). */
function hydrateSets(session: LiveSession): LiveSession {
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  return {
    ...session,
    exercises: exercises.map((ex) => ({
      ...ex,
      sets: (session.exerciseLogs?.find((l) => l.exerciseId === ex.exerciseId)?.sets ?? []).map((s) => ({
        setNumber: s.setNumber,
        weightKg: s.weightKg,
        reps: s.reps,
        rpe: s.rpe,
        isPr: s.isPr,
      })),
    })),
  };
}

type SpeechRecognitionLike = {
  lang: string;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
};

/** Big +/- stepper input — gym gloves friendly (44px+ targets). */
function NumberPadInput({
  label,
  value,
  onChange,
  step,
  integer = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  integer?: boolean;
}) {
  const current = parseLocaleNumber(value) ?? 0;
  const bump = (dir: 1 | -1) => {
    const next = Math.max(0, Math.round((current + dir * step) * 100) / 100);
    onChange(integer ? String(Math.round(next)) : String(next));
  };
  return (
    <div>
      <span className="block text-xs text-esi-text-muted mb-1.5">{label}</span>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => bump(-1)}
          className="w-11 shrink-0 rounded-xl bg-surface-2 text-xl font-bold active:scale-95 transition-transform"
          aria-label={`کاهش ${label}`}
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="۰"
          aria-label={label}
          className="h-12 w-full min-w-0 rounded-xl border border-border bg-surface-2 text-center text-lg font-bold tabular-nums outline-none focus:border-primary transition-colors"
        />
        <button
          type="button"
          onClick={() => bump(1)}
          className="w-11 shrink-0 rounded-xl bg-surface-2 text-xl font-bold active:scale-95 transition-transform"
          aria-label={`افزایش ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function WorkoutCompleteSummary({ sessionName, summary }: { sessionName: string; summary: CompleteSummary | null }) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center px-6 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-3xl border border-border bg-surface-1 p-8 text-center relative overflow-hidden"
      >
        <div aria-hidden className="absolute -top-20 start-1/3 h-56 w-56 rounded-full bg-mint-400/12 blur-3xl" />
        <span className="text-5xl" aria-hidden>🎉</span>
        <h1 className="mt-4 text-2xl font-extrabold">تمرین کامل شد!</h1>
        <p className="mt-1 text-sm text-esi-text-secondary">{sessionName}</p>

        {summary && (
          <dl className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "حجم کل", value: `${toPersianDigits(summary.volume)} کیلو` },
              { label: "مدت", value: `${toPersianDigits(summary.durationMinutes)} دقیقه` },
              { label: "ست‌ها", value: toPersianDigits(summary.setCount) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface-2 px-2 py-3">
                <dt className="text-[11px] text-esi-text-muted">{s.label}</dt>
                <dd className="mt-1 text-sm font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {summary?.prs && summary.prs.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/8 px-4 py-3 text-sm">
            <p className="font-bold text-amber-400">🏆 رکورد شخصی جدید!</p>
            <ul className="mt-2 space-y-1 text-xs text-esi-text-secondary">
              {summary.prs.map((pr, i) => (
                <li key={i}>
                  {pr.exerciseName} — <strong className="tabular-nums">{toPersianDigits(pr.value)}</strong> {pr.unit === "kg" ? "کیلوگرم" : pr.unit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary?.newBadges && summary.newBadges.length > 0 && (
          <div className="mt-3 rounded-2xl border border-primary/40 bg-primary/8 px-4 py-3 text-sm">
            <p className="font-bold text-primary">نشان جدید: {summary.newBadges.join("، ")}</p>
          </div>
        )}

        {summary?.xpAwarded ? (
          <p className="mt-4 text-sm font-semibold text-primary">+{toPersianDigits(summary.xpAwarded)} امتیاز تجربه</p>
        ) : null}

        <div className="mt-7 flex gap-3">
          <Button asChild variant="secondary" className="h-12 flex-1">
            <a href="/analytics">تحلیل پیشرفت</a>
          </Button>
          <Button asChild className="h-12 flex-1">
            <a href="/dashboard">داشبورد</a>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}


/** Exercise library picker sheet (free-session add flow). */
function PickerSheet({
  library,
  loading,
  query,
  setQuery,
  onAdd,
  onClose,
}: {
  library: Array<{ id: string; nameFa: string; equipment: string }>;
  loading: boolean;
  query: string;
  setQuery: (v: string) => void;
  onAdd: (exerciseId: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      onClick={(e) => e.stopPropagation()}
      className="w-full sm:max-w-md max-h-[80dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border bg-surface-1 flex flex-col"
    >
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <h3 className="font-bold">افزودن حرکت</h3>
        <button type="button" onClick={onClose} aria-label="بستن" className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center">
          <Icon name="X" size={16} />
        </button>
      </div>
      <div className="p-3 border-b border-border">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی حرکت…"
          className="w-full h-10 rounded-xl bg-surface-2 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="جستجوی حرکت"
        />
      </div>
      <ul className="overflow-y-auto p-3 space-y-1.5">
        {loading && <li className="py-8 text-center text-sm text-esi-text-muted">در حال بارگذاری…</li>}
        {!loading &&
          library
            .filter((ex) => !query.trim() || ex.nameFa.includes(query.trim()))
            .slice(0, 40)
            .map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => onAdd(ex.id)}
                  className="w-full text-start rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-3 active:scale-[0.99]"
                >
                  {ex.nameFa}
                </button>
              </li>
            ))}
        {!loading && library.every((ex) => query.trim() && !ex.nameFa.includes(query.trim())) && (
          <li className="py-8 text-center text-sm text-esi-text-muted">حرکتی با این نام پیدا نشد</li>
        )}
      </ul>
    </motion.div>
  );
}
