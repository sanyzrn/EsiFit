"use client";

import * as React from "react";

import type { ClientSession } from "@/lib/auth/session-types";
export type { ClientSession };

const SessionContext = React.createContext<ClientSession | null>(null);
const SessionRefreshContext = React.createContext<() => void>(() => undefined);

export function SessionProvider({
  initial,
  children,
}: {
  initial: ClientSession | null;
  children: React.ReactNode;
}) {
  const [session, setSession] = React.useState<ClientSession | null>(initial);
  const refresh = React.useCallback(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSession(d.user))
      .catch(() => undefined);
  }, []);
  return (
    <SessionContext.Provider value={session}>
      <SessionRefreshContext.Provider value={refresh}>{children}</SessionRefreshContext.Provider>
    </SessionContext.Provider>
  );
}

export function useSession(): ClientSession | null {
  return React.useContext(SessionContext);
}

export function useSessionRefresh(): () => void {
  return React.useContext(SessionRefreshContext);
}
