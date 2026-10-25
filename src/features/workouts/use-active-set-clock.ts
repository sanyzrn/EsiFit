"use client";

import * as React from "react";
import {
  pauseSetClock,
  restoreSetClock,
  resumeSetClock,
  setElapsedSeconds,
  type ActiveSetClock,
} from "@/lib/workout/rest-clock";

export function useActiveSetClock(key: string, enabled: boolean) {
  const [state, setState] = React.useState<{
    key: string;
    clock: ActiveSetClock;
  } | null>(null);
  const [now, setNow] = React.useState(0);
  const previous = React.useRef({ key, enabled });
  const storedKey = React.useRef(key);
  React.useEffect(() => {
    const timestamp = Date.now();
    let raw: string | null = null;
    try {
      if (storedKey.current !== key) localStorage.removeItem(storedKey.current);
      storedKey.current = key;
      raw = localStorage.getItem(key);
    } catch {
      /* unavailable */
    }
    const restored = restoreSetClock(raw, timestamp);
    setState({
      key,
      clock: enabled ? restored : pauseSetClock(restored, timestamp),
    });
    setNow(timestamp);
    // A new exercise/set has its own persisted clock, not a reset of another one.
  }, [key]);
  React.useEffect(() => {
    const before = previous.current;
    previous.current = { key, enabled };
    if (before.key !== key || before.enabled === enabled) return;
    const timestamp = Date.now();
    setNow(timestamp);
    setState((current) =>
      current?.key === key
        ? {
            key,
            clock: enabled
              ? resumeSetClock(current.clock, timestamp)
              : pauseSetClock(current.clock, timestamp),
          }
        : current,
    );
  }, [enabled, key]);
  React.useEffect(() => {
    if (state?.key !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(state.clock));
    } catch {
      /* in-memory timer remains usable */
    }
  }, [state, key]);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const clock = state?.key === key ? state.clock : null;
  return {
    seconds: setElapsedSeconds(clock, now),
    paused: !clock || clock.startedAt === null,
    toggle: () => {
      if (!enabled) return;
      const timestamp = Date.now();
      setNow(timestamp);
      setState((current) =>
        current?.key === key
          ? {
              key,
              clock:
                current.clock.startedAt === null
                  ? resumeSetClock(current.clock, timestamp)
                  : pauseSetClock(current.clock, timestamp),
            }
          : current,
      );
    },
  };
}
