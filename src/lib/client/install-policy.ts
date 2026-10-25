/** Product thresholds: visible engagement, never an arrival-time promotion. */
export const INSTALL_MIN_ACTIVE_SECONDS = 90;
export const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
export type InstallEngagement = { seconds: number; paths: string[]; actions: number };
export function canPromoteInstall(progress: InstallEngagement, now: number, dismissedUntil: number): boolean {
  return now >= dismissedUntil && progress.seconds >= INSTALL_MIN_ACTIVE_SECONDS &&
    (new Set(progress.paths).size >= 2 || progress.actions >= 3);
}
