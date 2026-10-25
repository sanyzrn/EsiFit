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
import { TIER_LABELS, type UserTier } from "@/lib/entitlements/entitlements";
import { toPersianDigits, parseLocaleNumber } from "@/lib/formatting/numbers";
import { formatRelative } from "@/lib/dates/jalali";
import { clearLocalUserData, getQueuedOperations } from "@/lib/offline/adapter";
import { withDeadline } from "@/lib/client/with-deadline";
import { EQUIPMENT_KEYS, EQUIPMENT_LABEL_FA } from "@/lib/workout/equipment";
import { cn } from "@/lib/utils";

type Device = { id: string; deviceLabel: string; lastSeenAt: string };

export function SettingsView({
  session,
  devices,
}: {
  session: { id: string; displayName: string; phone: string; tier: string; role: "admin" | "coach" | "member" };
  devices: Device[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const memberAccount = session.role === "member";

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
    if (loggingOut) return;
    setLoggingOut(true);
    let signedOut = false;
    try {
      // IndexedDB can remain blocked indefinitely on Android/Chrome after
      // another tab or suspended PWA keeps an old database connection alive.
      let remaining: Awaited<ReturnType<typeof getQueuedOperations>> | null = null;
      try {
        remaining = await withDeadline(getQueuedOperations(), 1500);
      } catch {
        if (!window.confirm(
          "بررسی داده‌های آفلاین این دستگاه ممکن نشد. خروج ممکن است داده‌های همگام‌نشده را حذف کند. ادامه می‌دهید؟",
        )) return;
      }
      if (remaining && remaining.length > 0 && !window.confirm(
        `شما ${remaining.length} مورد همگام‌نشده دارید. با خروج، این داده‌ها از این دستگاه حذف می‌شوند. ادامه می‌دهید؟`,
      )) return;

      const controller = new AbortController();
      let response: Response;
      try {
        response = await withDeadline(fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        }), 12000);
      } catch {
        throw new Error("اتصال به سرور برای خروج برقرار نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.");
      } finally {
        controller.abort();
      }
      if (!response.ok) {
        throw new Error("خروج در سرور انجام نشد. لطفاً دوباره تلاش کنید.");
      }
      signedOut = true;

      // Do not await mobile IndexedDB indefinitely *after* revoking the server
      // session: the purge marker is persisted, and a later DB open completes
      // the purge before exposing data even if this browser suspends the page.
      try {
        await withDeadline(clearLocalUserData(), 1500);
      } catch {
        // The crash-safe purge marker remains in localStorage for next open.
      }
      // Full document navigation discards stale Next.js Router & React state.
      window.location.replace("/auth/login");
    } catch (error) {
      toast({
        title: "خروج ناموفق بود",
        description: error instanceof Error ? error.message : errorMessage(error),
        variant: "destructive",
      });
    } finally {
      if (!signedOut) setLoggingOut(false);
    }
  };

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
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
      toast({ title: "خروجی داده آماده شد", description: "فایل JSON داده‌های ورزشی، سفارش‌ها و اشتراک‌های شما دانلود شد." });
    } catch (e) {
      toast({ title: "خروجی ناموفق بود", description: errorMessage(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Staff has an account control panel, not a partially hidden athlete panel.
  // Avoid constructing workout tracking components or calling personal APIs.
  if (!memberAccount) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-8">
        <PageHeader
          title="تنظیمات حساب"
          description={session.role === "admin" ? "مدیریت حساب مدیر سیستم" : "تنظیمات حساب مربی"}
          backHref={session.role === "admin" ? "/admin" : "/coach"}
        />
        <div className="space-y-4 px-4 lg:px-8">
          <section className="rounded-2xl border border-border bg-surface-1 p-5" aria-label="حساب کاری">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-bold text-primary">
                {session.displayName.trim()[0] || "؟"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{session.displayName}</p>
                <p className="mt-1 text-xs text-esi-text-muted" dir="ltr">{toPersianDigits(session.phone)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary">
                {session.role === "admin" ? "مدیر سیستم" : "مربی"}
              </span>
            </div>
            <p className="mt-4 border-t border-border pt-3 text-xs leading-6 text-esi-text-secondary">
              این حساب فقط برای امور {session.role === "admin" ? "مدیریت سایت" : "مربی‌گری"} است؛
              بخش‌های تمرین شخصی، تجهیزات ورزشی، تغذیه و اشتراک ورزشکار در این حساب وجود ندارند.
            </p>
          </section>
          <section className="rounded-2xl border border-border bg-surface-1 p-5" aria-label="دستگاه‌های فعال">
            <h2 className="text-sm font-bold">دستگاه‌های فعال</h2>
            <ul className="mt-3 space-y-2">
              {devices.length === 0 && <li className="py-3 text-xs text-esi-text-muted">دستگاه فعالی یافت نشد.</li>}
              {devices.map((device) => (
                <li key={device.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-3">
                  <Icon name="Smartphone" size={16} className="shrink-0 text-esi-text-muted" />
                  <span dir="ltr" className="min-w-0 flex-1 truncate text-xs">{device.deviceLabel}</span>
                  <span className="shrink-0 text-[10px] text-esi-text-muted">{formatRelative(device.lastSeenAt)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-border bg-surface-1 p-5" aria-label="امنیت و حریم خصوصی">
            <h2 className="text-sm font-bold">امنیت حساب</h2>
            <p className="mt-2 text-xs leading-6 text-esi-text-secondary">
              تنظیمات هویتی و دسترسی‌های حساس، فقط از جریان‌های مدیریت مجاز تغییر می‌کنند.
            </p>
          </section>
          <Button variant="secondary" className="h-12 w-full" onClick={() => void logout()} disabled={loggingOut}>
            <Icon name="LogOut" size={17} />
            {loggingOut ? "در حال خروج…" : "خروج از حساب"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full pb-6 space-y-5">
      <PageHeader title="تنظیمات" description="حساب، ترجیحات و حریم خصوصی" backHref={session.role === "admin" ? "/admin" : session.role === "coach" ? "/coach" : "/dashboard"} />

      <div className="px-4 lg:px-8 space-y-4">
        {/* profile */}
        <section aria-label="پروفایل" className="esi-card rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl esi-gradient-brand flex items-center justify-center text-primary-foreground text-xl font-bold">
              {session.displayName.trim()[0]}
            </div>
            <div className="min-w-0">
              <p className="font-bold">{session.displayName}</p>
              <p className="text-xs text-esi-text-muted tabular-nums" dir="ltr">{toPersianDigits(session.phone)}</p>
            </div>
            <span className="ms-auto rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
              {memberAccount ? TIER_LABELS[session.tier as UserTier] : session.role === "admin" ? "مدیر سایت" : "مربی"}
            </span>
          </div>
        </section>

        {/* preferences */}
        <section aria-label="ترجیحات" className="esi-card rounded-3xl p-6 space-y-5">
          <h2 className="font-bold">ترجیحات</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">کاهش حرکت</p>
              <p className="text-xs text-esi-text-muted mt-0.5">انیمیشن‌ها و جلوه‌های محیطی حداقل می‌شوند</p>
            </div>
            <Switch checked={reducedMotion} onCheckedChange={toggleReducedMotion} aria-label="کاهش حرکت" />
          </div>
          {memberAccount && <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">واحد اندازه‌گیری</p>
              <p className="text-xs text-esi-text-muted mt-0.5">همه داده‌ها به کیلوگرم/سانتی‌متر ذخیره می‌شوند</p>
            </div>
            <span className="text-xs font-bold text-esi-text-secondary">متریک</span>
          </div>}
        </section>

        {memberAccount && <EquipmentSection />}

        {/* devices */}
        <section aria-label="دستگاه‌ها" className="esi-card rounded-3xl p-6">
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
        {memberAccount && <PainSection />}

        {/* privacy */}
        <section aria-label="حریم خصوصی" className="esi-card rounded-3xl p-6 space-y-4">
          <h2 className="font-bold">حریم خصوصی و داده</h2>
          <p className="text-xs leading-6 text-esi-text-secondary">
            {memberAccount
              ? "داده‌های ورزشی و شخصی شما خصوصی هستند. مدیریت دسترسی و خروجی اطلاعات از این قسمت انجام می‌شود."
              : "حساب مدیریتی فقط برای دسترسی به ابزارهای کاری استفاده می‌شود. داده‌های ورزشکاران در بخش مربوط به نقش شما مدیریت می‌شوند."}
          </p>
          <div className="flex flex-wrap gap-2">
            {memberAccount && <Button variant="secondary" size="sm" className="h-9" onClick={exportData} disabled={exporting}>
              <Icon name="Download" size={15} />
              {exporting ? "در حال آماده‌سازی…" : "خروجی داده‌ها (همهٔ پلن‌ها)"}
            </Button>}
            <p className="w-full text-xs leading-6 text-esi-text-muted">حذف حساب در این نسخه هنوز در دسترس نیست.</p>
          </div>
        </section>

        <Button variant="secondary" className="w-full h-12" onClick={() => void logout()} disabled={loggingOut}>
          <Icon name="LogOut" size={17} />
          {loggingOut ? "در حال خروج…" : "خروج از حساب"}
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
    <section aria-label="درد و محدودیت‌ها" className="esi-card rounded-3xl p-6 space-y-4">
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

function EquipmentSection() {
  const { toast } = useToast();
  const router = useRouter();
  const [fullGym, setFullGym] = React.useState(true);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api<{ availableEquipment: string[]; unrestricted: boolean }>("/api/settings/profile");
        setFullGym(res.unrestricted);
        setSelected(res.unrestricted ? [] : res.availableEquipment);
      } catch {
        setFullGym(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = fullGym ? [] : selected;
      await api("/api/settings/profile", { method: "PATCH", json: { availableEquipment: payload } });
      toast({
        title: "وسایل ذخیره شد",
        description: "برنامه ۴ هفته‌ای را از صفحه تمرین بازسازی کنید تا جایگزین‌ها اعمال شوند.",
      });
      router.refresh();
    } catch (e) {
      toast({ title: "ذخیره ناموفق", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <section className="esi-card rounded-3xl p-6 h-32 animate-pulse" aria-label="وسایل" />;
  }

  return (
    <section aria-label="وسایل ورزشی" className="esi-card rounded-3xl p-6 space-y-4">
      <div>
        <h2 className="font-bold">وسایل ورزشی</h2>
        <p className="text-xs text-esi-text-secondary mt-1 leading-5">
          برنامه تمرین و جایگزین‌های هوشمند فقط حرکاتی را پیشنهاد می‌دهند که با وسایل شما قابل اجرا هستند.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFullGym(true)}
          aria-pressed={fullGym}
          className={cn(
            "min-h-10 rounded-xl border px-3 py-2 text-sm transition-colors",
            fullGym ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-esi-text-secondary",
          )}
        >
          باشگاه کامل
        </button>
        {!fullGym &&
          EQUIPMENT_KEYS.map((k) => {
            const on = selected.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSelected((prev) => (on ? prev.filter((x) => x !== k) : [...prev, k]))
                }
                className={cn(
                  "min-h-10 rounded-xl border px-3 py-2 text-sm transition-colors",
                  on ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-esi-text-secondary",
                )}
              >
                {EQUIPMENT_LABEL_FA[k]}
              </button>
            );
          })}
        {fullGym && (
          <button
            type="button"
            className="text-xs text-primary underline-offset-2 hover:underline min-h-10"
            onClick={() => {
              setFullGym(false);
              setSelected(["bodyweight", "dumbbell"]);
            }}
          >
            وسایل محدود دارم
          </button>
        )}
      </div>
      <Button size="sm" className="h-10" onClick={() => void save()} disabled={saving || (!fullGym && selected.length === 0)}>
        {saving ? "…" : "ذخیره وسایل"}
      </Button>
    </section>
  );
}
