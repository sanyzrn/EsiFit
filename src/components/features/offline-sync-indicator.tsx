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

export { InstallPrompt } from "./install-prompt";
