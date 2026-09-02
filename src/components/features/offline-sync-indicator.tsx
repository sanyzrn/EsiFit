"use client";

import * as React from "react";
import { queuedCount, syncQueue } from "@/lib/offline/adapter";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/formatting/numbers";

/**
 * OfflineSyncIndicator — visible but calm (DESIGN_BIBLE PWA rules).
 * Never blocks logging; shows queued writes + reconnect sync.
 */
export function OfflineIndicator() {
  const [online, setOnline] = React.useState(true);
  const [pending, setPending] = React.useState(0);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    queuedCount().then(setPending);

    const goOnline = () => {
      setOnline(true);
      void syncQueue();
    };
    const goOffline = () => setOnline(false);
    const queueChanged = () => void queuedCount().then(setPending);
    const syncStatus = () => void queuedCount().then(setPending);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("esifit:queue-changed", queueChanged);
    window.addEventListener("esifit:sync-status", syncStatus);
    const interval = window.setInterval(() => {
      if (navigator.onLine) void syncQueue();
    }, 30_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("esifit:queue-changed", queueChanged);
      window.removeEventListener("esifit:sync-status", syncStatus);
      window.clearInterval(interval);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-20 lg:bottom-6 start-4 z-50 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium shadow-[var(--shadow-float)] esi-glass border",
        online ? "border-border text-esi-text-secondary" : "border-amber-400/40 text-amber-400",
      )}
    >
      <Icon
        name={online ? "CloudUpload" : "CloudOff"}
        size={14}
        className={cn(online && pending > 0 && "animate-pulse")}
      />
      {online
        ? pending > 0
          ? `${toPersianDigits(pending)} مورد در انتظار همگام‌سازی`
          : "همگام‌سازی…"
        : "آفلاین — تغییرات محفوظ می‌ماند"}
    </div>
  );
}

/** Install prompt — contextual, dismissible, no aggressive nagging. */
export function InstallPrompt() {
  const [deferred, setDeferred] = React.useState<Event | null>(null);
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    const stored = localStorage.getItem("esifit-install-dismissed");
    setDismissed(stored === "1");
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      if (localStorage.getItem("esifit-install-dismissed") !== "1") setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem("esifit-install-dismissed", "1");
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="نصب اسی‌فیت"
      className="fixed bottom-20 lg:bottom-6 inset-x-4 lg:inset-x-auto lg:end-6 lg:w-96 z-50 rounded-2xl border border-border bg-surface-1 p-4 shadow-[var(--shadow-float)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl esi-gradient-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8" stroke="var(--primary-foreground)" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">اسی‌فیت را نصب کنید</p>
          <p className="text-xs text-esi-text-secondary mt-0.5 leading-5">
            دسترسی سریع، حالت تمام‌صفحه و کارکرد آفلاین در تمرین‌ها
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-transform duration-150 active:scale-95"
              onClick={async () => {
                const prompt = deferred as Event & { prompt?: () => Promise<void> };
                await prompt.prompt?.();
                dismiss();
              }}
            >
              نصب
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-xs text-esi-text-muted hover:text-esi-text-primary"
              onClick={dismiss}
            >
              بعداً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
