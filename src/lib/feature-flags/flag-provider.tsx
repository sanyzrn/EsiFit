"use client";

import * as React from "react";
import { resolveEnabledFlags, type FeatureFlag } from "@/lib/feature-flags/registry";

/**
 * Flag provider — server resolves the effective registry (env-aware) and
 * passes it down; client components read through useFeatureFlag (fail-closed).
 */

const FlagContext = React.createContext<Record<FeatureFlag, boolean> | null>(null);

export function FeatureFlagProvider({
  flags,
  children,
}: {
  flags?: Record<FeatureFlag, boolean>;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => flags ?? resolveEnabledFlags(), [flags]);
  return <FlagContext.Provider value={value}>{children}</FlagContext.Provider>;
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const flags = React.useContext(FlagContext);
  return Boolean(flags?.[flag]);
}

export function useFlags(): Record<FeatureFlag, boolean> {
  const flags = React.useContext(FlagContext);
  return flags ?? resolveEnabledFlags();
}
