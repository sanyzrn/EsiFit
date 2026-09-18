"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { PageHeader } from "@/components/layout/app-shell";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/lib/client/use-session";
import { TIER_LABELS, getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";
import { toPersianDigits, parseLocaleNumber } from "@/lib/formatting/numbers";
import { formatRelative } from "@/lib/dates/jalali";
import { clearLocalUserData, syncQueue, getQueuedOperations } from "@/lib/offline/adapter";

type Device = { id: string; deviceLabel: string; lastSeenAt: string };

export function SettingsView({
  session,
  devices,
}: {
  session: { id: string; displayName: string; phone: string; tier: string };
  devices: Device[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const ent = getEntitlements(session.tier as UserTier);

  React.useEffect(() => {
    const stored = localStorage.getItem("esifit-reduced-motion");
    const prefersOs = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const on = stored != null ? stored === "1" : prefersOs;
    setReducedMotion(on);
    document.documentElement.dataset.reducedMotion = on ? "1" : "0";
  }, []);

  const toggleReducedMotion = (on: boolean) => {
    setReducedMotion(on);
    localStorage.setItem("esifit-reduced-motion", on ? "1" : "0");
    document.documentElement.dataset.reducedMotion = on ? "1" : "0";
    toast({ title: on ? "حالت کاهش حرکت فعال شد" : "حالت کاهش حرکت خاموش شد" });
  };

  const logout = async () => {
    // Best-effort flush: never destroy unsynced workout/water data silently.
    try {
      await syncQueue();
      const remaining = await getQueuedOperations();
      if (remaining.length > 0) {
        const proceed = window.confirm(
          "خروج داده‌های همگام‌نشده را از این دستگاه حذف می‌کند. ادامه می‌دهید؟",
        );
        if (!proceed) return;
      }
    } catch {
      // sync unavailable — still allow logout
    }
    await fetch("/api/auth/logout", { method: "POST" });
    // Server-side revocation is not enough: the offline queue, the read-through
    // cache and the cached pages live on this device and must go with it.
    await clearLocalUserData();
    router.push("/");
    router.refresh();
  };

  const exportData = async () => {
    if (!ent.dataExport) {
      toast({
        title: "خروجی داده در پلن وی‌آی‌پی",
        description: "خروجی کامل داده‌ها یکی از مزایای اشتراک وی‌آی‌پی است.",
      });
      return;
    }
    try {
      const res = await fetch("/api/settings/export", { credentials: "same-origin" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        toast({ title: "خروجی ناموفق بود", description: body?.message ?? "دوباره تلاش کنید.", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `esifit-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "خروجی داده آماده شد", description: "فایل JSON کامل داده‌های شما دانلود شد." });
    } catch (e) {
      toast({ title: "خروجی ناموفق بود", description: errorMessage(e), variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full pb-6 space-y-5">
      <PageHeader title="تنظیمات" description="حساب، ترجیحات و حریم خصوصی" />

      <div className="px-4 lg:px-8 space-y-4">
        {/* profile */}
        <section aria-label="پروفایل" className="rounded-3xl border border-border bg-surface-1 p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl esi-gradient-brand flex items-center justify-center text-primary-foreground text-xl font-bold">
              {session.displayName.trim()[0]}
            </div>
            <div className="min-w-0">
              <p className="font-bold">{session.displayName}</p>
              <p className="text-xs text-esi-text-muted tabular-nums" dir="ltr">{toPersianDigits(session.phone)}</p>
            </div>
            <span className="ms-auto rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
              {TIER_LABELS[session.tier as UserTier]}
            </span>
          </div>
        </section>

        {/* preferences */}
        <section aria-label="ترجیحات" className="rounded-3xl border border-border bg-surface-1 p-6 space-y-5">
          <h2 className="font-bold">ترجیحات</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">کاهش حرکت</p>
              <p className="text-xs text-esi-text-muted mt-0.5">انیمیشن‌ها و جلوه‌های محیطی حداقل می‌شوند</p>
            </div>
            <Switch checked={reducedMotion} onCheckedChange={toggleReducedMotion} aria-label="کاهش حرکت" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">واحد اندازه‌گیری</p>
              <p className="text-xs text-esi-text-muted mt-0.5">همه داده‌ها به کیلوگرم/سانتی‌متر ذخیره می‌شوند</p>
            </div>
            <span className="text-xs font-bold text-esi-text-secondary">متریک</span>
          </div>
        </section>

        {/* devices */}
        <section aria-label="دستگاه‌ها" className="rounded-3xl border border-border bg-surface-1 p-6">
          <h2 className="font-bold mb-4">دستگاه‌های فعال</h2>
          <ul className="space-y-2.5">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
                <Icon name="Smartphone" size={16} className="text-esi-text-muted shrink-0" />
                <p className="text-xs truncate flex-1" dir="ltr">{d.deviceLabel}</p>
                <span className="text-[10px] text-esi-text-muted shrink-0">{formatRelative(d.lastSeenAt)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* pain & limitations */}
        <PainSection />

        {/* privacy */}
        <section aria-label="حریم خصوصی" className="rounded-3xl border border-border bg-surface-1 p-6 space-y-4">
          <h2 className="font-bold">حریم خصوصی و داده</h2>
          <p className="text-xs leading-6 text-esi-text-secondary">
            داده‌های سلامت شما (وزن، اندازه‌ها، عکس‌ها) خصوصی هستند و فقط با اجازه شما پردازش می‌شوند.
            خروجی و حذف کامل همیشه در دسترس شماست.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="h-9" onClick={exportData}>
              <Icon name="Download" size={15} />
              خروجی داده‌ها
            </Button>
            {!confirmingDelete ? (
              <Button variant="ghost" size="sm" className="h-9 text-destructive" onClick={() => setConfirmingDelete(true)}>
                حذف حساب
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-1.5">
                <span className="text-xs text-esi-text-secondary">مطمئنید؟ این اقدام بازگشت‌پذیر نیست.</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => toast({ title: "حذف حساب", description: "در محیط دمو غیرفعال است — در نسخه تولیدی با تأیید پیامکی انجام می‌شود." })}
                >
                  بله، حذف کن
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setConfirmingDelete(false)}>
                  انصراف
                </Button>
              </div>
            )}
          </div>
        </section>

        <Button variant="secondary" className="w-full h-12" onClick={() => void logout()}>
          <Icon name="LogOut" size={17} />
          خروج از حساب
        </Button>

        <p className="text-center text-[10px] text-esi-text-muted">اسی‌فیت نسخه ۱٫۰ — ساخته‌شده با Next.js و PWA</p>
      </div>
    </div>
  );
}


const PAIN_REGION_FA: Record<string, string> = {
  lower_back: "کمر پایین", shoulder: "سرشانه", knee: "زانو", elbow: "آرنج",
  wrist: "مچ", hip: "لگن", ankle: "قوزک پا", neck: "گردن", groin: "کشاله ران",
  ribs: "دنده", other: "سایر",
};

type PainRow = { id: string; bodyRegion: string; severity: number; reportedOn: string; note: string };

function PainSection() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<PainRow[] | null>(null);
  const [region, setRegion] = React.useState("shoulder");
  const [severity, setSeverity] = React.useState(4);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api<{ reports: PainRow[] }>("/api/pain-reports")
      .then((d) => setRows(d.reports))
      .catch(() => setRows([]));
  }, []);

  React.useEffect(load, [load]);

  const add = async () => {
    setBusy(true);
    try {
      await api("/api/pain-reports", { method: "POST", json: { bodyRegion: region, severity, note: "" } });
      toast({ title: "ثبت شد", description: "حرکات پرریسک از پیشنهادهای هوشمند حذف می‌شوند." });
      load();
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id: string) => {
    try {
      await api("/api/pain-reports", { method: "PATCH", json: { id, status: "resolved" } });
      load();
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    }
  };

  return (
    <section aria-label="درد و محدودیت‌ها" className="rounded-3xl border border-border bg-surface-1 p-6 space-y-4">
      <div>
        <h2 className="font-bold flex items-center gap-2">
          <Icon name="HeartPulse" size={17} className="text-primary" />
          درد و محدودیت‌ها
        </h2>
        <p className="text-xs text-esi-text-secondary mt-1 leading-5">
          ناحیه‌های حساس بدن را ثبت کنید تا جایگزین‌های هوشمند، حرکات پرریسک را پیشنهاد ندهند. این اطلاعات پزشکی نیست و فقط برای ایمن‌تر شدن پیشنهادها استفاده می‌شود.
        </p>
      </div>

      {rows === null ? (
        <div className="h-16 rounded-2xl bg-surface-2 animate-pulse" />
      ) : rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
              <span className="text-sm font-semibold">{PAIN_REGION_FA[r.bodyRegion] ?? r.bodyRegion}</span>
              <span className="text-[11px] text-esi-text-muted">شدت {toPersianDigits(r.severity)} از ۱۰</span>
              <span className="text-[10px] text-esi-text-muted ms-auto">{formatRelative(r.reportedOn)}</span>
              <button type="button" onClick={() => void resolve(r.id)} className="text-[11px] text-primary hover:underline shrink-0">
                بهبود یافت
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-esi-text-muted">موردی ثبت نشده است.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="ناحیه بدن"
          className="h-10 rounded-xl bg-surface-2 px-3 text-sm outline-none"
        >
          {Object.entries(PAIN_REGION_FA).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-esi-text-secondary">
          شدت:
          <input
            type="range" min={1} max={10} value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-28 accent-[var(--primary)]"
            aria-label="شدت درد"
          />
          <span className="tabular-nums font-bold">{toPersianDigits(severity)}</span>
        </label>
        <Button variant="secondary" size="sm" className="h-10" onClick={() => void add()} disabled={busy}>
          ثبت
        </Button>
      </div>
    </section>
  );
}
