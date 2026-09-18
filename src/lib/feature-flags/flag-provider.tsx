"use client";

import * as React from "react";
import { FEATURE_FLAGS, type FeatureFlag } from "@/lib/feature-flags/registry";

/**
 * Flag provider — server resolves the effective registry (env-aware) and
 * passes it down. On the client, missing flags fail closed (all false):
 * server-only ESIFIT_FLAG_* env is never readable in the browser.
 */

const FlagContext = React.createContext<Record<FeatureFlag, boolean> | null>(null);

function failClosedFlags(): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>;
  for (const flag of FEATURE_FLAGS) out[flag] = false;
  return out;
}

export function FeatureFlagProvider({
  flags,
  children,
}: {
  flags?: Record<FeatureFlag, boolean>;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => flags ?? failClosedFlags(), [flags]);
  return <FlagContext.Provider value={value}>{children}</FlagContext.Provider>;
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const flags = React.useContext(FlagContext);
  return Boolean(flags?.[flag]);
}

export function useFlags(): Record<FeatureFlag, boolean> {
  const flags = React.useContext(FlagContext);
  return flags ?? failClosedFlags();
}
