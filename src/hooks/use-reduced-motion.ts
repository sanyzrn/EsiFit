"use client";
import { useSyncExternalStore } from "react";
const query = "(prefers-reduced-motion: reduce)";
function subscribe(notify: () => void) {
  const media = window.matchMedia(query); media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;
/** Stable first render, followed by the actual live media preference. */
export function useReducedMotion(): boolean { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
