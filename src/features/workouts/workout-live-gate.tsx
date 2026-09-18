"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { WorkoutSessionHUD, type LiveSession } from "@/features/workouts/workout-session-hud";
import { api, errorMessage } from "@/lib/client/api";
import { syncQueue } from "@/lib/offline/adapter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Live gate — resolves or starts the session, drains any offline queue
 * BEFORE hydrating so the HUD shows the freshest merged state.
 */
export function WorkoutLiveGate() {
  const params = useSearchParams();
  const planDayId = params.get("planDay") ?? undefined;
  const sessionId = params.get("session") ?? undefined;
  const [session, setSession] = React.useState<LiveSession | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncQueue(); // replay offline sets first
        const res = await api<{ session: LiveSession }>("/api/workouts/sessions", {
          method: "POST",
          json: {
            ...(planDayId ? { planDayId } : {}),
            ...(sessionId ? { sessionId } : {}),
          },
        });
        if (!cancelled) setSession(res.session);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planDayId, sessionId]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <span className="text-4xl" aria-hidden>🏋️</span>
        <h1 className="text-xl font-bold">شروع تمرین ممکن نشد</h1>
        <p className="text-sm text-esi-text-secondary">{error ?? "جلسه‌ای یافت نشد."}</p>
        <Button asChild variant="secondary">
          <a href="/workouts">انتخاب از کتابخانه تمرین</a>
        </Button>
      </div>
    );
  }

  return <WorkoutSessionHUD initialSession={session} />;
}
