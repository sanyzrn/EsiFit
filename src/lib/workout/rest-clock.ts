/** EsiFit's own clock model: seconds anchored to wall time, safe across tab sleep. */
export type WorkoutRest = {
  exerciseId: string;
  endsAt: number;
  total: number;
  pausedRemaining?: number;
};

export function restRemainingSeconds(
  rest: WorkoutRest | null,
  now: number,
): number {
  if (!rest) return 0;
  if (rest.pausedRemaining !== undefined)
    return Math.max(0, rest.pausedRemaining);
  return Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
}

export function startWorkoutRest(
  exerciseId: string,
  seconds: number,
  now: number,
): WorkoutRest {
  const total = Math.max(1, Math.round(seconds));
  return { exerciseId, total, endsAt: now + total * 1000 };
}

export function pauseWorkoutRest(rest: WorkoutRest, now: number): WorkoutRest {
  if (rest.pausedRemaining !== undefined) return rest;
  return { ...rest, pausedRemaining: restRemainingSeconds(rest, now) };
}

export function resumeWorkoutRest(rest: WorkoutRest, now: number): WorkoutRest {
  if (rest.pausedRemaining === undefined) return rest;
  const { pausedRemaining, ...base } = rest;
  return { ...base, endsAt: now + pausedRemaining * 1000 };
}

export function adjustWorkoutRest(
  rest: WorkoutRest,
  deltaSeconds: number,
  now: number,
): WorkoutRest {
  const before = restRemainingSeconds(rest, now);
  const after = Math.max(0, Math.min(3600, before + deltaSeconds));
  const total = Math.max(1, Math.min(3600, rest.total + after - before), after);
  return rest.pausedRemaining === undefined
    ? { ...rest, total, endsAt: now + after * 1000 }
    : { ...rest, total, pausedRemaining: after };
}

export function restClockLabel(seconds: number): string {
  const time = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
}

/** Count-up clock for an active set, anchored to wall time across app switches. */
export type ActiveSetClock = {
  accumulatedMs: number;
  startedAt: number | null;
};
export function startSetClock(now: number): ActiveSetClock {
  return { accumulatedMs: 0, startedAt: now };
}
export function setElapsedSeconds(
  clock: ActiveSetClock | null,
  now: number,
): number {
  if (!clock) return 0;
  return Math.max(
    0,
    Math.floor(
      (clock.accumulatedMs +
        (clock.startedAt === null ? 0 : now - clock.startedAt)) /
        1000,
    ),
  );
}
export function pauseSetClock(
  clock: ActiveSetClock,
  now: number,
): ActiveSetClock {
  return clock.startedAt === null
    ? clock
    : {
        accumulatedMs: clock.accumulatedMs + Math.max(0, now - clock.startedAt),
        startedAt: null,
      };
}
export function resumeSetClock(
  clock: ActiveSetClock,
  now: number,
): ActiveSetClock {
  return clock.startedAt === null ? { ...clock, startedAt: now } : clock;
}
export function restoreSetClock(
  raw: string | null,
  now: number,
): ActiveSetClock {
  try {
    const clock = JSON.parse(raw ?? "null") as ActiveSetClock | null;
    if (
      clock &&
      Number.isFinite(clock.accumulatedMs) &&
      clock.accumulatedMs >= 0 &&
      clock.accumulatedMs <= 86400000 &&
      (clock.startedAt === null ||
        (Number.isFinite(clock.startedAt) &&
          clock.startedAt <= now &&
          clock.startedAt >= now - 86400000))
    )
      return clock;
  } catch {
    /* A malformed local clock never prevents starting a workout. */
  }
  return startSetClock(now);
}
