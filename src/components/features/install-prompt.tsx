"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-mark";
import { canPromoteInstall, INSTALL_DISMISS_MS, type InstallEngagement } from "@/lib/client/install-policy";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const INSTALL_PROGRESS = "esifit:install-engagement";
const INSTALL_DISMISSED = "esifit:install-dismissed-until";
const INSTALL_SHOWN = "esifit:install-shown";

/** One root listener retains the browser event across navigation. */
export function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = React.useState<InstallEvent | null>(null);
  const [eligible, setEligible] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [offeredOn, setOfferedOn] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const progress = React.useRef<InstallEngagement>({ seconds: 0, paths: [], actions: 0 });
  const safeRoute = ["/", "/dashboard", "/coach", "/workouts", "/plans", "/store"].includes(pathname) || /^\/(calculators|blog)(?:\/|$)/.test(pathname);

  React.useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(INSTALL_PROGRESS) ?? "null");
      if (saved && Number.isFinite(saved.seconds) && Array.isArray(saved.paths) && Number.isFinite(saved.actions)) progress.current = saved;
      setDismissed(sessionStorage.getItem(INSTALL_SHOWN) === "1" || localStorage.getItem("esifit-install-dismissed") === "1");
    } catch { /* Storage is optional; this visit still works. */ }
    const standalone = matchMedia("(display-mode: standalone)");
    const detect = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    detect();
    const capture = (event: Event) => { event.preventDefault(); setDeferred(event as InstallEvent); setError(""); };
    const completed = () => { setInstalled(true); setDeferred(null); };
    const interact = (event: Event) => { if (event.isTrusted) progress.current.actions = Math.min(10, progress.current.actions + 1); };
    let previous = Date.now();
    const tick = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") progress.current.seconds += Math.min(5, Math.max(0, (now - previous) / 1000));
      previous = now;
      let until = 0;
      try { until = Number(localStorage.getItem(INSTALL_DISMISSED) ?? "0"); sessionStorage.setItem(INSTALL_PROGRESS, JSON.stringify(progress.current)); } catch { /* optional storage */ }
      const editing = document.activeElement?.matches("input, textarea, select, [contenteditable=true]");
      const dialog = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]');
      setEligible(canPromoteInstall(progress.current, now, until) && !editing && !dialog);
    }, 5000);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", completed);
    document.addEventListener("pointerup", interact, { passive: true });
    document.addEventListener("keydown", interact);
    standalone.addEventListener("change", detect);
    return () => {
      clearInterval(tick); window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", completed);
      document.removeEventListener("pointerup", interact); document.removeEventListener("keydown", interact); standalone.removeEventListener("change", detect);
    };
  }, []);
  React.useEffect(() => {
    if (!progress.current.paths.includes(pathname)) progress.current.paths = [...progress.current.paths, pathname].slice(-20);
  }, [pathname]);
  const visible = deferred && eligible && !installed && !dismissed && safeRoute && (!offeredOn || offeredOn === pathname);
  React.useEffect(() => {
    if (visible) { setOfferedOn(previous => previous ?? pathname); try { sessionStorage.setItem(INSTALL_SHOWN, "1"); } catch { /* optional storage */ } }
  }, [visible, pathname]);
  if (!visible) return null;
  const dismiss = () => {
    try { localStorage.setItem(INSTALL_DISMISSED, String(Date.now() + INSTALL_DISMISS_MS)); } catch { /* optional storage */ }
    setDismissed(true);
  };
  return createPortal(
    <aside aria-label="نصب اسی‌فیت" className="fixed z-50 inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:end-6 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface-1 p-4 text-esi-text-primary">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2"><BrandLogo size={36} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">اسی‌فیت، دم دستت</p>
          <p className="mt-1 text-xs leading-5 text-esi-text-secondary">برای دسترسی سریع‌تر، اسی‌فیت را به صفحهٔ اصلی دستگاه اضافه کن.</p>
          {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button type="button" disabled={busy || Boolean(error)} className="min-h-11 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50" onClick={async () => {
              setBusy(true); setError("");
              try { await deferred.prompt(); const choice = await deferred.userChoice; if (choice.outcome === "accepted") setInstalled(true); else dismiss(); setDeferred(null); }
              catch { setError("نصب انجام نشد؛ می‌توانی از منوی مرورگر استفاده کنی."); }
              finally { setBusy(false); }
            }}>{busy ? "در حال نصب…" : "افزودن به دستگاه"}</button>
            <button type="button" onClick={dismiss} className="min-h-11 rounded-lg px-3 text-xs text-esi-text-muted hover:text-esi-text-primary">بعداً</button>
          </div>
        </div>
      </div>
    </aside>, document.body,
  );
}
