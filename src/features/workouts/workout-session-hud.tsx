"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage, isApiError } from "@/lib/client/api";
import { enqueueOperation, newClientId, syncQueue, syncWorkoutBeforeComplete } from "@/lib/offline/adapter";
import { useFeatureFlag } from "@/lib/feature-flags/flag-provider";
import { formatClock, parseLocaleNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";
import {
  adjustWorkoutRest, pauseWorkoutRest, resumeWorkoutRest,
  restClockLabel, restRemainingSeconds, startWorkoutRest,
  type WorkoutRest as RestPhase,
} from "@/lib/workout/rest-clock";
import { LastTimeCard, PlateCalculator, WarmupHint, type ExerciseHistoryView } from "@/features/workouts/exercise-assist";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useActiveSetClock } from "@/features/workouts/use-active-set-clock";
import { ExerciseVisual } from "@/features/workouts/exercise-visual";
import { incrementFor } from "@/lib/workout/progression";
import { rankBySearch } from "@/lib/search/normalize";
import { burstConfetti } from "@/components/motion/confetti";
import { KhatamStar } from "@/components/motion/khatam";

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
  equipment?: string;
  instructions?: string;
  history?: ExerciseHistoryView;
  sets?: Array<{ id?: string; setNumber: number; weightKg: number | null; reps: number | null; rpe?: number | null; isPr?: boolean; isWarmup?: boolean }>;
};

export type LiveSession = {
  id: string;
  name: string;
  startedAt: string;
  planDayId?: string | null;
  exercises: LiveExercise[];
  exerciseLogs?: Array<{ exerciseId: string; sets: Array<{ id: string; setNumber: number; weightKg: number | null; reps: number | null; rpe: number | null; isPr: boolean; isWarmup?: boolean }> }>;
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
  const router = useRouter();
  const reduced = useReducedMotion();
  const voiceFlag = useFeatureFlag("VOICE_LOGGING");
  const swapFlag = useFeatureFlag("EXERCISE_SWAP");
  const [session, setSession] = React.useState<LiveSession>(() => hydrateSets(initialSession));
  const [currentIdx, setCurrentIdx] = React.useState(() => {
    const exercises = hydrateSets(initialSession).exercises;
    const firstIncomplete = exercises.findIndex((ex) => (ex.sets?.filter(s => !s.isWarmup).length ?? 0) < Math.max(1, ex.targetSets));
    return firstIncomplete === -1 ? Math.max(0, exercises.length - 1) : firstIncomplete;
  });
  const [focusMode, setFocusMode] = React.useState(true);
  const [captureOpen, setCaptureOpen] = React.useState(false);
  const [isWarmup, setIsWarmup] = React.useState(false);
  const [weight, setWeight] = React.useState("");
  const [reps, setReps] = React.useState("");
  const [rpe, setRpe] = React.useState<number | null>(null);
  const [rest, setRest] = React.useState<RestPhase | null>(null);
  const [restClock, setRestClock] = React.useState(() => Date.now());
  const alertedRestRef = React.useRef<string | null>(null);
  const [finishSavedSetsOnly, setFinishSavedSetsOnly] = React.useState(false);
  const [finishConfirm, setFinishConfirm] = React.useState(false);
  const [confirmSkipRest, setConfirmSkipRest] = React.useState(false);
  const [allowExtraSet, setAllowExtraSet] = React.useState(false);
  const [savingSet, setSavingSet] = React.useState(false);
  const loggingRef = React.useRef(false);
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

  // The timestamp/paused state is persisted so switching apps doesn't reset rest.
  const restKey = `esifit:workout-rest:${session.id}`;
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(restKey);
      if (!stored) return;
      const value = JSON.parse(stored) as RestPhase;
      const remaining = restRemainingSeconds(value, Date.now());
      if (Number.isFinite(value.endsAt) && Number.isFinite(value.total)
        && value.total > 0 && value.total <= 3600
        && session.exercises.some((e) => e.exerciseId === value.exerciseId)
        && (remaining > 0 || Date.now() - value.endsAt < 120_000)) {
        setRest(value);
        setRestClock(Date.now());
      } else localStorage.removeItem(restKey);
    } catch {
      localStorage.removeItem(restKey);
    }
  }, [restKey]);

  React.useEffect(() => {
    if (!rest) return;
    const tick = () => {
      const now = Date.now();
      setRestClock(now);
      const key = `${rest.exerciseId}:${rest.endsAt}`;
      if (rest.pausedRemaining === undefined && now >= rest.endsAt && alertedRestRef.current !== key) {
        alertedRestRef.current = key;
        navigator.vibrate?.([60, 40, 60]);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [rest]);

  React.useEffect(() => {
    setAllowExtraSet(false);
    setIsWarmup(false);
    setConfirmSkipRest(false);
  }, [currentIdx]);

  const exercise = session.exercises[currentIdx];
  const loggedSets = React.useMemo(() => {
    const fromServer = session.exerciseLogs?.find((l) => l.exerciseId === exercise?.exerciseId)?.sets ?? [];
    const local = exercise?.sets ?? [];
    const map = new Map<number, { setNumber: number; weightKg: number | null; reps: number | null; rpe?: number | null; isPr?: boolean; isWarmup?: boolean }>();
    for (const s of [...fromServer, ...local]) map.set(s.setNumber, s);
    return [...map.values()].sort((a, b) => a.setNumber - b.setNumber);
  }, [session, exercise, loggedVersion]);
  const nextSetNumber = (loggedSets[loggedSets.length - 1]?.setNumber ?? 0) + 1;
  const targetSets = Math.max(1, exercise?.targetSets ?? 1);
  const workingSetCount = loggedSets.filter(s => !s.isWarmup).length;
  const targetComplete = workingSetCount >= targetSets;
  const restRemaining = restRemainingSeconds(rest, restClock);
  const isResting = Boolean(rest && exercise && rest.exerciseId === exercise.exerciseId && restRemaining > 0);
  const restReady = Boolean(rest && restRemaining === 0);
  const restPaused = Boolean(rest && rest.pausedRemaining !== undefined);
  const restExercise = session.exercises.find((ex) => ex.exerciseId === rest?.exerciseId);
  const totalPlannedSets = session.exercises.reduce((sum, ex) => sum + Math.max(1, ex.targetSets), 0);
  const totalWorkingSets = session.exercises.reduce((sum, ex) => sum + (ex.sets?.filter(s => !s.isWarmup).length ?? 0), 0);
  const totalLoggedSets = session.exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
  const workoutProgress = totalPlannedSets > 0
    ? Math.min(100, Math.round(session.exercises.reduce((sum, ex) => sum + Math.min(ex.sets?.filter(s => !s.isWarmup).length ?? 0, Math.max(1, ex.targetSets)), 0) / totalPlannedSets * 100))
    : 0;
  const isLastExercise = currentIdx === session.exercises.length - 1;
  const setClock = useActiveSetClock(`esifit:set-clock:${session.id}:${exercise?.exerciseId ?? "empty"}:${nextSetNumber}`, !rest && (!targetComplete || allowExtraSet) && !completed && !captureOpen);
  const nextExercise = targetComplete && !isLastExercise ? session.exercises[currentIdx + 1] : exercise;
  const dismissRest = () => {
    saveRest(null);
    if (targetComplete && !isLastExercise && rest?.exerciseId === exercise?.exerciseId) setCurrentIdx(index => index + 1);
  };
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
      const d = await api<{ log: { id: string; exerciseId: string; name: string; slug: string; instructions?: string; equipment?: string; targetSets: number; targetRepsMin: number; targetRepsMax: number; targetRpe: number; restSeconds: number; note: string } }>(
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
                instructions: d.log.instructions,
                equipment: d.log.equipment,
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
    if (last) {
      setWeight(last.weightKg != null ? String(last.weightKg) : "");
      setReps(last.reps != null ? String(last.reps) : "");
    } else {
      // First set of this exercise: open on today's suggested load (from last time)
      // instead of empty inputs.
      const s = exercise?.history?.suggestion;
      setWeight(s?.weightKg != null ? String(s.weightKg) : "");
      setReps(s?.reps != null ? String(s.reps) : "");
    }
    setRpe(null);
  }, [currentIdx, loggedSets]);

  const applySuggestion = () => {
    const s = exercise?.history?.suggestion;
    if (!s) return;
    if (s.weightKg != null) setWeight(String(s.weightKg));
    if (s.reps != null) setReps(String(s.reps));
  };
  const [plateOpen, setPlateOpen] = React.useState(false);

  const saveRest = (next: RestPhase | null) => {
    setRest(next);
    setRestClock(Date.now());
    setConfirmSkipRest(false);
    try {
      if (next) localStorage.setItem(restKey, JSON.stringify(next));
      else localStorage.removeItem(restKey);
    } catch {
      // Private browsing may forbid storage; timer still works in memory.
    }
  };

  const logSet = async () => {
    // Guard synchronously as well as in the UI; fast taps must not create
    // multiple offline operations before React updates the button state.
    if (!exercise || loggingRef.current || isResting || (targetComplete && !allowExtraSet)) return;
    const w = parseLocaleNumber(weight);
    const r = parseLocaleNumber(reps);
    if (r == null || !Number.isInteger(r) || r < 1 || r > 200) {
      setError("تکرار باید عددی صحیح بین ۱ تا ۲۰۰ باشد.");
      return;
    }
    if (w != null && (w < 0 || w > 600)) {
      setError("وزن را در محدوده معتبر وارد کنید.");
      return;
    }
    if (nextSetNumber > 30) {
      setError("سقف ثبت برای هر حرکت ۳۰ ست است.");
      return;
    }

    loggingRef.current = true;
    setSavingSet(true);
    setError(null);
    const clientId = newClientId("set");
    const payload = {
      clientId,
      sessionId: session.id,
      exerciseId: exercise.exerciseId,
      orderIndex: currentIdx,
      setNumber: nextSetNumber,
      weightKg: w,
      reps: r,
      rpe: rpe ?? undefined,
      isWarmup,
      completedAt: new Date().toISOString(),
    };

    try {
      // Store first, then update the UI; if local storage fails, don't show
      // a phantom set that the athlete believes was recorded.
      await enqueueOperation({ clientId, kind: "workout_set", endpoint: "/api/workouts/sync", payload });
      setSession((previous) => ({
        ...previous,
        exercises: previous.exercises.map((ex, i) =>
          i === currentIdx
            ? { ...ex, sets: [...(ex.sets ?? []), { setNumber: nextSetNumber, weightKg: w, reps: r, rpe, isWarmup }] }
            : ex,
        ),
      }));
      void syncQueue();
      navigator.vibrate?.(35);
      setAllowExtraSet(false);
      setCaptureOpen(false);

      // Rest between sets and movements, but never after the final planned set.
      if ((workingSetCount + (isWarmup ? 0 : 1) < targetSets || !isLastExercise) && exercise.restSeconds > 0) {
        saveRest(startWorkoutRest(exercise.exerciseId, Math.max(30, exercise.restSeconds), Date.now()));
      } else {
        saveRest(null);
      }
    } catch {
      setError("ست ذخیره نشد؛ فضای ذخیره‌سازی مرورگر را بررسی و دوباره تلاش کنید.");
    } finally {
      loggingRef.current = false;
      setSavingSet(false);
    }
  };

  const abandonEmpty = async () => {
    if (busy || totalLoggedSets !== 0) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/workouts/sessions", { method: "DELETE", json: { sessionId: session.id } });
      saveRest(null);
      router.push("/workouts");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const finish = async (acknowledgeConflicts = false) => {
    setFinishSavedSetsOnly(false);
    setBusy(true);
    setError(null);
    try {
      await syncWorkoutBeforeComplete(session.id, acknowledgeConflicts);
      const res = await api<{ summary: CompleteSummary }>("/api/workouts/complete", {
        method: "POST",
        json: { sessionId: session.id, durationSeconds: elapsed },
      });
      setSummary(res.summary);
      setFinishConfirm(false);
      saveRest(null);
      setCompleted(true);
    } catch (e) {
      if (isApiError(e) && "canFinishSavedSets" in e && e.canFinishSavedSets === true) setFinishSavedSetsOnly(true);
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

  const setCapture = (
<section className="rounded-[26px] border border-border bg-surface-1 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{targetComplete && !allowExtraSet ? "حرکت کامل شد" : `آماده‌سازی ست ${toPersianDigits(nextSetNumber)}`}</p>
                <p className="mt-0.5 text-[11px] text-esi-text-muted">
                  {isResting ? "استراحت در حال انجام است؛ وزن و تکرار را برای ست بعد تنظیم کن" : "تکرار واقعی را بعد از انجام ست ثبت کن"}
                </p>
              </div>
              <span className="shrink-0 rounded-xl bg-surface-2 px-2.5 py-1.5 text-xs font-bold tabular-nums text-esi-text-secondary">
                {toPersianDigits(workingSetCount)} / {toPersianDigits(targetSets)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberPadInput
                label="وزن (کیلوگرم)"
                value={weight}
                onChange={setWeight}
                step={incrementFor(exercise.equipment ?? "barbell")}
              />
              <NumberPadInput
                label="تکرار"
                value={reps}
                onChange={setReps}
                step={1}
                integer
              />
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm text-esi-text-secondary">
              <input type="checkbox" checked={isWarmup} onChange={event => setIsWarmup(event.target.checked)} className="accent-primary" />
              ست گرم‌کردن (بدون رکورد و پیشرفت ست‌های اصلی)
            </label>
            {exercise.equipment === "barbell" && (parseLocaleNumber(weight) ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => { setCaptureOpen(false); setPlateOpen(true); }}
                className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-surface-2 text-xs font-medium text-esi-text-secondary transition-colors hover:text-primary active:scale-[0.99]"
              >
                <Icon name="Dumbbell" size={14} />
                چه صفحه‌هایی ببندم؟
              </button>
            )}
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
              <Button
                className="flex-1 h-12 text-base font-bold"
                onClick={() => void logSet()}
                disabled={savingSet || isResting || (targetComplete && !allowExtraSet)}
              >
                {savingSet
                  ? "در حال ذخیره…"
                  : isResting
                    ? `استراحت • ${toPersianDigits(restRemaining)} ثانیه`
                    : targetComplete && !allowExtraSet
                      ? "ست‌های برنامه کامل شد"
                      : `ثبت پایان ست ${toPersianDigits(nextSetNumber)}`}
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
          </section>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col safe-top safe-bottom">
      {/* ---- Top bar: session meta ---- */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-esi-text-muted shrink-0">{toPersianDigits(currentIdx + 1)}/{toPersianDigits(session.exercises.length)}</span>
          <p className="text-sm font-semibold truncate">{session.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-esi-text-secondary">
          <button type="button" onClick={() => setFocusMode(value => !value)} className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-primary" aria-label={focusMode ? "نمایش جزئیات تمرین" : "بازگشت به حالت تمرکز"}>
            <Icon name={focusMode ? "List" : "Maximize2"} size={17} />{focusMode ? "جزئیات" : "تمرکز"}
          </button>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Icon name="Timer" size={16} />
            {formatClock(elapsed)}
          </span>
          <a
            href="/workouts"
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-esi-text-secondary"
            aria-label="خروج از صفحه بدون پایان دادن؛ جلسه حفظ می‌شود"
          >
            خروج
          </a>
          <button
            type="button"
            onClick={() => setFinishConfirm(true)}
            disabled={busy}
            className="min-h-11 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
          >
            پایان تمرین
          </button>
        </div>
      </header>
      <div className="h-1 shrink-0 bg-surface-3" role="progressbar" aria-label="پیشرفت جلسه تمرین" aria-valuemin={0} aria-valuemax={100} aria-valuenow={workoutProgress}>
        <motion.div
          className="h-full rounded-e-full bg-primary"
          initial={false}
          animate={{ width: `${workoutProgress}%` }}
          transition={{ duration: reduced ? 0 : 0.35 }}
        />
      </div>

      {/* ---- Exercise strip ---- */}
      {!focusMode && <div className="shrink-0 border-b border-border px-3 py-2.5">
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
            const done = (ex.sets?.filter(s => !s.isWarmup).length ?? 0) >= ex.targetSets;
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
      </div>}
      {/* ---- Current exercise + set entry ---- */}
      {focusMode ? (
        <section className="esi-workout-focus min-h-0 flex-1 overflow-y-auto" aria-label="حالت تمرکز تمرین">
          <div className="flex min-h-0 flex-col bg-surface-1">
            <div className="shrink-0 px-4 pb-2 pt-4 text-center">
              <p className="text-xs font-bold text-primary">حرکت {toPersianDigits(currentIdx + 1)} از {toPersianDigits(session.exercises.length)}</p>
              <h1 className="mt-2 text-xl font-extrabold leading-snug sm:text-2xl">{exercise.name}</h1>
            </div>
            <ExerciseVisual key={exercise.exerciseId} slug={exercise.slug} name={exercise.name} instructions={exercise.instructions} autoPlay playing={!setClock.paused && !rest} immersive />
          </div>
          <div className="flex flex-col justify-center gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-10">
            <div className="flex items-center justify-between gap-3 text-xs text-esi-text-secondary">
              <span>ست {toPersianDigits(Math.min(workingSetCount + 1, targetSets))} از {toPersianDigits(targetSets)}</span>
              <span>{toPersianDigits(exercise.targetRepsMin)} تا {toPersianDigits(exercise.targetRepsMax)} تکرار</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-esi-text-muted">{targetComplete ? "حرکت کامل شد" : setClock.paused ? "زمان ست · متوقف" : "زمان این ست"}</p>
              <p role="timer" aria-label="زمان سپری‌شده این ست" className="mt-1 font-display text-6xl leading-none tabular-nums sm:text-7xl" dir="ltr">{toPersianDigits(formatClock(setClock.seconds))}</p>
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            {targetComplete && !allowExtraSet ? (
              <div className="space-y-2">
                <Button className="min-h-14 w-full gap-2 text-base font-bold" onClick={() => isLastExercise ? setFinishConfirm(true) : setCurrentIdx(index => index + 1)}><Icon name="Check" size={20} />{isLastExercise ? "پایان جلسه و دیدن نتیجه" : "بریم حرکت بعدی"}</Button>
                {nextSetNumber <= 30 && <Button variant="ghost" className="min-h-11 w-full text-xs" onClick={() => setAllowExtraSet(true)}>افزودن یک ست خارج از برنامه</Button>}
              </div>
            ) : (
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <Button variant="secondary" className="min-h-14 min-w-14" onClick={setClock.toggle} aria-label={setClock.paused ? "ادامه زمان ست" : "مکث زمان ست"}><Icon name={setClock.paused ? "Play" : "Pause"} size={22} /></Button>
                <Button className="min-h-14 gap-2 text-base font-bold" onClick={() => setCaptureOpen(true)} disabled={savingSet || Boolean(rest)}><Icon name="Check" size={20} />ثبت پایان ست</Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-2">
              <Button variant="ghost" className="min-h-11 gap-2 text-xs" disabled={currentIdx === 0 || savingSet} onClick={() => setCurrentIdx(index => index - 1)}><Icon name="ChevronRight" size={17} />حرکت قبلی</Button>
              <Button variant="ghost" className="min-h-11 gap-2 text-xs" disabled={isLastExercise || savingSet} onClick={() => setCurrentIdx(index => index + 1)}>حرکت بعدی<Icon name="ChevronLeft" size={17} /></Button>
            </div>
            <p className="text-center text-[11px] leading-5 text-esi-text-muted">پخش تصویر برای یادگیری حرکت است؛ تکرار واقعی را بعد از ست ثبت کن.</p>
          </div>
        </section>
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto max-w-lg px-4 py-6 space-y-6", rest && "pb-32")}>
          {/* Focus card: one real exercise, planned effort and visible set progress. */}
          <section className="relative overflow-hidden rounded-[26px] border border-border bg-surface-1 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-esi-text-secondary">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary">
                    حرکت {toPersianDigits(currentIdx + 1)} از {toPersianDigits(session.exercises.length)}
                  </span>
                  <span className="tabular-nums">{toPersianDigits(totalLoggedSets)} ست ثبت‌شده در جلسه</span>
                </div>
                <h2 className="text-2xl font-bold leading-snug">{exercise.name}</h2>
                <p className="mt-2 text-xs leading-6 text-esi-text-secondary">
                  {toPersianDigits(targetSets)} ست • {toPersianDigits(exercise.targetRepsMin)} تا {toPersianDigits(exercise.targetRepsMax)} تکرار
                  {" • "}استراحت {toPersianDigits(exercise.restSeconds)} ثانیه
                  {exercise.note ? ` • ${exercise.note}` : ""}
                </p>
              </div>
              {swapFlag && loggedSets.length === 0 && (
                <button
                  type="button"
                  onClick={() => void openSwap()}
                  className="shrink-0 rounded-full border border-border bg-surface-2 px-3 py-2 text-[11px] font-bold text-esi-text-secondary transition-colors hover:text-primary hover:border-primary/40 active:scale-95"
                >
                  <span className="flex items-center gap-1.5">
                    <Icon name="Shuffle" size={13} />
                    جایگزینی
                  </span>
                </button>
              )}
            </div>
            <div className="mt-5 flex items-center gap-2" aria-label={`${workingSetCount} ست اصلی از ${targetSets} ست برنامه تکمیل شده`}>
              {Array.from({ length: Math.min(12, targetSets) }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex h-8 min-w-0 flex-1 items-center justify-center rounded-xl border text-xs font-semibold tabular-nums transition-colors",
                    i < workingSetCount
                      ? "border-primary bg-primary/15 text-primary"
                      : i === workingSetCount && !targetComplete
                        ? "border-primary/40 bg-surface-2 text-esi-text-primary"
                        : "border-border bg-surface-2 text-esi-text-muted",
                  )}
                >
                  {i < workingSetCount ? <Icon name="Check" size={14} /> : toPersianDigits(i + 1)}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-esi-text-muted">
              {targetComplete ? "ست‌های برنامه این حرکت کامل شد" : `${toPersianDigits(workingSetCount)} از ${toPersianDigits(targetSets)} ست کامل شده`}
            </p>
          </section>

          <ExerciseVisual slug={exercise.slug} name={exercise.name} />

          <LastTimeCard history={exercise.history} onApply={loggedSets.length === 0 ? applySuggestion : undefined} />
          {loggedSets.length === 0 && exercise.equipment === "barbell" && (parseLocaleNumber(weight) ?? 0) > 20 && (
            <WarmupHint workKg={parseLocaleNumber(weight) ?? 0} />
          )}

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

          {setCapture}

          {targetComplete && (
            <motion.section
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-primary/35 bg-primary/10 p-4"
              aria-label="پایان حرکت"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Icon name="Check" size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">این حرکت تموم شد!</p>
                  <p className="mt-0.5 text-xs text-esi-text-secondary">{toPersianDigits(workingSetCount)} ست انجام‌شده؛ نوبت مرحله بعده.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => isLastExercise ? setFinishConfirm(true) : setCurrentIdx((v) => v + 1)}
                disabled={busy}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
              >
                {isLastExercise ? "پایان جلسه و دیدن نتیجه" : `حرکت بعدی: ${session.exercises[currentIdx + 1].name}`}
                <Icon name="ChevronLeft" size={16} />
              </button>
              {!allowExtraSet && nextSetNumber <= 30 && (
                <button
                  type="button"
                  onClick={() => setAllowExtraSet(true)}
                  className="mt-2 min-h-10 w-full rounded-xl text-xs font-medium text-esi-text-secondary underline-offset-4 hover:underline"
                >
                  + افزودن یک ست خارج از برنامه
                </button>
              )}
            </motion.section>
          )}

          {/* next exercise preview */}
          {!isLastExercise && (
            <p className="text-center text-xs text-esi-text-muted pb-4">
              حرکت بعد: <strong className="text-esi-text-secondary">{session.exercises[currentIdx + 1].name}</strong>
            </p>
          )}
        </div>
      </div>

      )}
      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetContent side="bottom" className="z-[70] max-h-[90dvh] overflow-y-auto rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="mx-auto w-full max-w-lg text-start">
            <SheetTitle>نتیجه واقعی این ست</SheetTitle>
            <SheetDescription>{exercise.name} · ست {toPersianDigits(nextSetNumber)}</SheetDescription>
          </SheetHeader>
          <div className="mx-auto w-full max-w-lg px-4">{setCapture}</div>
        </SheetContent>
      </Sheet>

      <AnimatePresence>
        {plateOpen && <PlateCalculator targetKg={parseLocaleNumber(weight) ?? 0} onClose={() => setPlateOpen(false)} />}
      </AnimatePresence>

      {/* Docked rest bar: all actions stay in fixed slots as the timer turns Ready. */}
      <AnimatePresence>
        {rest && (
          <motion.section
            initial={reduced ? false : { y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 35 }}
            className={cn("absolute z-20 border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)]", focusMode ? "inset-0 flex flex-col justify-center overflow-y-auto px-4" : "inset-x-0 bottom-0")}
            aria-label="کنترل استراحت"
          >
            {focusMode && <button type="button" onClick={() => setFocusMode(false)} className="absolute start-4 top-4 min-h-11 rounded-xl border border-border px-4 text-xs font-bold">نمایش تمرین</button>}
            {focusMode && <div className="mx-auto mb-4 w-full max-w-lg text-center"><p className="text-sm font-bold text-primary">نفس بگیر، مرحله بعد نزدیکه</p><p className="mt-4 font-display text-7xl tabular-nums" dir="ltr">{restReady ? "آماده" : toPersianDigits(restClockLabel(restRemaining))}</p><p className="mt-2 text-xs text-esi-text-muted">{restPaused ? "تایمر متوقف شده" : restReady ? "هر وقت آماده‌ای ادامه بده" : "زمان باقی‌مانده استراحت"}</p></div>}
            <div className="h-1 w-full bg-surface-3" aria-hidden="true">
              <div
                className={cn("h-full transition-[width] duration-500", restReady ? "bg-emerald-500" : "bg-primary")}
                style={{ width: `${restReady ? 100 : Math.max(0, Math.min(100, 100 * (1 - restRemaining / Math.max(1, rest.total))))}%` }}
              />
            </div>
            <div className="mx-auto flex max-w-lg flex-col gap-2 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs text-esi-text-secondary">
                  {restReady ? "آماده‌ای! نوبت ست بعدیه" : restPaused ? "استراحت متوقف شده" : "در حال استراحت"}
                  {restExercise && <span className="ms-2 text-esi-text-muted">• {restExercise.name}</span>}
                </div>
                <span className="shrink-0 text-[10px] text-esi-text-muted">مرحله استراحت</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <div className={cn("min-w-[75px] flex-1 text-center font-display text-2xl tabular-nums max-[360px]:basis-full", focusMode && "hidden", restReady ? "text-emerald-600" : "text-primary")} role="timer" aria-label={restReady ? "استراحت تمام شد" : `${restRemaining} ثانیه مانده`}>
                  {restReady ? "آماده" : toPersianDigits(restClockLabel(restRemaining))}
                </div>
                <button
                  type="button"
                  aria-label="۱۵ ثانیه کاهش استراحت"
                  disabled={restReady}
                  onClick={() => saveRest(adjustWorkoutRest(rest, -15, Date.now()))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-xs font-bold disabled:opacity-30"
                >
                  <span aria-hidden className="tabular-nums text-xs font-bold">−۱۵</span>
                </button>
                <button
                  type="button"
                  aria-label="۱۵ ثانیه افزایش استراحت"
                  onClick={() => saveRest(restReady ? startWorkoutRest(rest.exerciseId, 15, Date.now()) : adjustWorkoutRest(rest, 15, Date.now()))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2"
                >
                  <span aria-hidden className="tabular-nums text-xs font-bold">+۱۵</span>
                </button>
                <button
                  type="button"
                  aria-label={restPaused ? "ادامه استراحت" : "مکث استراحت"}
                  disabled={restReady}
                  onClick={() => saveRest(restPaused ? resumeWorkoutRest(rest, Date.now()) : pauseWorkoutRest(rest, Date.now()))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 disabled:opacity-30"
                >
                  <Icon name={restPaused ? "Play" : "Pause"} size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => restReady || confirmSkipRest ? dismissRest() : setConfirmSkipRest(true)}
                  className={cn(
                    "h-11 min-w-[64px] shrink-0 rounded-xl px-2 text-xs font-bold",
                    confirmSkipRest || restReady ? "bg-primary text-primary-foreground" : "bg-surface-2 text-esi-text-secondary",
                  )}
                  aria-label={restReady ? "بستن تایمر آماده" : confirmSkipRest ? "تأیید رد استراحت" : "رد استراحت"}
                >
                  {restReady ? "آماده‌ام" : confirmSkipRest ? "تأیید" : "رد کردن"}
                </button>
              </div>
            </div>
            {focusMode && nextExercise && <div className="mx-auto mt-6 w-full max-w-sm rounded-2xl border border-border bg-background p-4 text-center"><p className="text-xs font-bold text-primary">بعدی: {nextExercise.name}</p><p className="mt-2 text-xs text-esi-text-secondary">{targetComplete ? "حرکت بعدی" : `ست ${toPersianDigits(nextSetNumber)} از ${toPersianDigits(targetSets)}`} · {toPersianDigits(nextExercise.targetRepsMin)} تا {toPersianDigits(nextExercise.targetRepsMax)} تکرار</p><ExerciseVisual key={nextExercise.exerciseId} slug={nextExercise.slug} name={nextExercise.name} compact className="mx-auto mt-4 w-36" /></div>}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Confirmation prevents accidentally ending half a workout or an empty session. */}
      <AnimatePresence>
        {finishConfirm && (
          <motion.div
            key="finish-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[75] flex items-end justify-center bg-black/70 p-3 sm:items-center"
            onClick={() => !busy && setFinishConfirm(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="تأیید پایان تمرین"
              initial={reduced ? false : { y: 24 }}
              animate={{ y: 0 }}
              exit={reduced ? undefined : { y: 24 }}
              className="w-full max-w-md rounded-3xl border border-border bg-surface-1 p-5 text-esi-text-primary shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="font-display text-2xl">پایان جلسه تمرین؟</p>
              <p className="mt-2 text-sm leading-7 text-esi-text-secondary">
                {toPersianDigits(totalWorkingSets)} ست اصلی از {toPersianDigits(totalPlannedSets)} ست برنامه ثبت شده.
                {totalWorkingSets < totalPlannedSets
                  ? " هنوز بخشی از برنامه انجام نشده؛ اگر تمام کنی، همان ست‌های واقعی ذخیره می‌شوند."
                  : " همه ست‌های برنامه تمام شده؛ آماده ثبت نتیجه هستی."}
              </p>
              <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                <div className="flex justify-between"><span>زمان جلسه</span><strong>{formatClock(elapsed)}</strong></div>
                <div className="mt-2 flex justify-between"><span>پیشرفت</span><strong>{toPersianDigits(workoutProgress)}٪</strong></div>
              </div>
              {totalWorkingSets === 0 && (
                <p className="mt-3 text-xs text-primary">هنوز ست اصلی ثبت نشده؛ می‌تونی جلسه رو برای ادامه بعدی نگه داری.</p>
              )}
              <div className="mt-5 grid gap-2">
                <Button
                  disabled={busy || totalWorkingSets === 0}
                  onClick={() => void finish()}
                  className="h-12 font-bold"
                >
                  {busy ? "در حال ثبت نتیجه…" : "تأیید و پایان تمرین"}
                </Button>
                {finishSavedSetsOnly && (
                  <Button variant="secondary" className="h-11" onClick={() => void finish(true)} disabled={busy}>
                    پایان فقط با ست‌های ثبت‌شده
                  </Button>
                )}
                <Button variant="secondary" className="h-11" onClick={() => setFinishConfirm(false)} disabled={busy}>
                  ادامه تمرین
                </Button>
                {totalLoggedSets === 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-xl border border-border bg-surface-2 text-xs font-bold text-esi-text-secondary disabled:opacity-50"
                    onClick={() => void abandonEmpty()}
                  >
                    لغو جلسه خالی و برگشت به کتابخانه
                  </button>
                )}
              </div>
              {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
            </motion.div>
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
              className="w-full sm:max-w-md max-h-[80dvh] overflow-y-auto rounded-t-3xl sm:esi-card rounded-3xl p-5 space-y-3"
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
        isWarmup: s.isWarmup,
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
  const hasPr = Boolean(summary?.prs?.length);
  React.useEffect(() => {
    // Finishing a workout is the app's big moment: a PR gets the full party.
    const t = setTimeout(() => {
      burstConfetti({ intensity: "party", count: hasPr ? 180 : 110 });
      navigator.vibrate?.(hasPr ? [30, 60, 30, 60, 90] : [40, 40, 80]);
    }, 350);
    return () => clearTimeout(t);
  }, [hasPr]);
  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center px-6 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md esi-card rounded-3xl p-8 text-center relative overflow-hidden"
      >
        <div aria-hidden className="absolute -top-20 start-1/3 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <KhatamStar size={260} strokeWidth={0.4} spin className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 text-primary/25 rtl:translate-x-1/2" />
        <motion.span
          className="relative inline-block text-6xl"
          aria-hidden
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.15 }}
        >
          🎉
        </motion.span>
        <h1 className="relative mt-4 font-display text-4xl leading-tight">تمرین کامل شد!</h1>
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
                <dd className="mt-1 font-display text-xl tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {summary?.prs && summary.prs.length > 0 && (
          <div className="esi-sheen mt-4 rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3 text-sm">
            <p className="font-bold text-primary">🏆 رکورد شخصی جدید!</p>
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
  const results = React.useMemo(() => rankBySearch(library, query, (ex) => [ex.nameFa]), [library, query]);
  return (
    <motion.div
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      onClick={(e) => e.stopPropagation()}
      className="w-full sm:max-w-md max-h-[80dvh] overflow-hidden rounded-t-3xl sm:esi-card rounded-3xl flex flex-col"
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
          results
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
        {!loading && results.length === 0 && (
          <li className="py-8 text-center text-sm text-esi-text-muted">حرکتی با این نام پیدا نشد</li>
        )}
      </ul>
    </motion.div>
  );
}
