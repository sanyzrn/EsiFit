"use client";
import * as React from "react";
import { PlanningSettings } from "./planning-settings";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/client/api";
import { formatRelative } from "@/lib/dates/jalali";
import { toPersianDigits } from "@/lib/formatting/numbers";

type Provider = {
  id: string;
  label: string;
  kind: "gemini" | "custom";
  baseUrl: string;
  model: string;
  enabled: boolean;
  testedAt: string;
};
type Grant = {
  providerId: string;
  enabled: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  updatedAt: string;
};
type User = {
  id: string;
  displayName: string;
  role: string;
  status: string;
  aiGrant: Grant | null;
  used: number;
  monthUsed: number;
};
type Data = {
  providers: Provider[];
  users: User[];
  total: number;
  actions: {
    id: string;
    preview: string;
    status: string;
    createdAt: string;
    actor: { displayName: string };
  }[];
};
const blank = {
  id: undefined as string | undefined,
  label: "",
  kind: "gemini" as "gemini" | "custom",
  baseUrl: "",
  model: "gemini-flash-latest",
  apiKey: "",
  enabled: true,
};
const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-surface-2 px-3 text-sm";
const actionStatus: Record<string, string> = {
  pending: "منتظر تأیید",
  executing: "در حال اجرا / نیازمند بررسی پنل",
  succeeded: "اجرا شد",
  failed: "ناموفق؛ پنل را بررسی کنید",
  cancelled: "لغوشده",
};
export function AiManagementTab() {
  const [data, setData] = React.useState<Data>();
  const [form, setForm] = React.useState(blank);
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();
  const [disable, setDisable] = React.useState<Provider>();
  const formRef = React.useRef<HTMLFormElement>(null);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await api<Data>(
          `/api/admin/ai?q=${encodeURIComponent(search)}&page=${page}`,
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, search]);
  React.useEffect(() => {
    void load();
  }, [load]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await api("/api/admin/ai", {
        method: "PUT",
        json: { ...form, apiKey: form.apiKey || undefined },
      });
      setForm(blank);
      setNotice("پاسخ و ابزارهای اتصال با موفقیت آزمایش و ذخیره شد.");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function deactivate() {
    if (!disable) return;
    setSaving(true);
    setError(undefined);
    try {
      await api("/api/admin/ai", {
        method: "DELETE",
        json: { id: disable.id },
      });
      setDisable(undefined);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-5">
      <PlanningSettings />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon name="Sparkles" size={20} className="text-primary" /> همپا،
            دستیار اسی‌فیت
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-6 text-esi-text-secondary">
            برای هر کاربر اتصال و سهمیهٔ مستقل تعیین کنید. همپا نقش کاربر را از
            سرور می‌گیرد و تغییرات مدیریتی را پس از نمایش جزئیات و تأیید اجرا
            می‌کند.
          </p>
        </div>
        <Button asChild>
          <Link href="/ai">گفت‌وگو با همپا</Link>
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm leading-7 text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-primary/30 p-4 text-sm text-primary"
        >
          {notice}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <form
          ref={formRef}
          onSubmit={(event) => void save(event)}
          className="space-y-4 rounded-2xl border border-border bg-surface-1 p-5"
        >
          <div className="flex justify-between gap-2">
            <h3 className="font-bold">
              {form.id ? "ویرایش اتصال" : "افزودن هوش مصنوعی"}
            </h3>
            {form.id && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm(blank)}
              >
                انصراف
              </Button>
            )}
          </div>
          <label className="block space-y-2 text-xs">
            <span>نام اتصال</span>
            <Input
              value={form.label}
              required
              maxLength={60}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="مثلاً جمنای تیم اسی‌فیت"
            />
          </label>
          <label className="block space-y-2 text-xs">
            <span>ارائه‌دهنده</span>
            <select
              className={fieldClass}
              value={form.kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  kind: e.target.value as "gemini" | "custom",
                  baseUrl: "",
                  model:
                    e.target.value === "gemini" ? "gemini-flash-latest" : "",
                })
              }
            >
              <option value="gemini">Google Gemini</option>
              <option value="custom">Custom — سازگار با OpenAI</option>
            </select>
          </label>
          <label className="block space-y-2 text-xs">
            <span>
              آدرس سرویس {form.kind === "gemini" ? "(اختیاری)" : "(الزامی)"}
            </span>
            <Input
              dir="ltr"
              type="url"
              value={form.baseUrl}
              required={form.kind === "custom"}
              maxLength={500}
              placeholder={
                form.kind === "gemini"
                  ? "https://generativelanguage.googleapis.com"
                  : "https://gateway.example/v1"
              }
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
            <span className="block leading-6 text-esi-text-muted">
              {form.kind === "gemini"
                ? "آدرس گوگل یا درگاهِ دارای پروتکل اصلی Gemini؛ با یا بدون /v1beta. پیشوند مسیر درگاه حفظ می‌شود."
                : "درگاهِ Chat Completions؛ آدرس پایه یا آدرس کامل /chat/completions قابل استفاده است."}
            </span>
          </label>
          <label className="block space-y-2 text-xs">
            <span>شناسهٔ مدل</span>
            <Input
              dir="ltr"
              value={form.model}
              required
              maxLength={150}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
            <span className="block leading-6 text-esi-text-muted">
              مدل باید پاسخ متنی و Function Calling داشته باشد. مدل انتخابی روی
              همین اتصال آزمایش می‌شود.
            </span>
          </label>
          <label className="block space-y-2 text-xs">
            <span>کلید API {form.id ? "(خالی = حفظ کلید فعلی)" : ""}</span>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={form.apiKey}
              required={!form.id}
              maxLength={2000}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
            <span className="block leading-6 text-esi-text-muted">
              کلید رمزگذاری می‌شود و در پاسخ API یا گفت‌وگو نمایش داده نمی‌شود.
              با تغییر آدرس، کلید به همان درگاه ارسال خواهد شد؛ مالک آدرس را
              بررسی کنید.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />{" "}
            اتصال فعال باشد
          </label>
          <Button type="submit" disabled={saving} className="w-full">
            {saving
              ? "در حال آزمایش اتصال و ابزارها…"
              : "آزمایش و ذخیرهٔ اتصال"}
          </Button>
        </form>
        <section className="rounded-2xl border border-border bg-surface-1 p-5">
          <h3 className="mb-3 font-bold">اتصال‌های ثبت‌شده</h3>
          {loading && !data ? (
            <p role="status" className="text-xs">
              در حال بارگذاری…
            </p>
          ) : !data?.providers.length ? (
            <p className="text-sm leading-7 text-esi-text-muted">
              اتصالی ثبت نشده است. یک اتصال اضافه کنید؛ سپس به کاربران دسترسی
              بدهید.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.providers.map((provider) => (
                <li
                  key={provider.id}
                  className="min-w-0 rounded-xl border border-border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="min-w-0 break-words text-sm">
                      {provider.label}
                    </strong>
                    <span className="shrink-0 text-xs text-primary">
                      {provider.enabled ? "فعال" : "غیرفعال"}
                    </span>
                  </div>
                  <p
                    className="mt-2 break-all text-xs text-esi-text-secondary"
                    dir="ltr"
                  >
                    {provider.model}
                  </p>
                  <p
                    className="mt-1 break-all text-[10px] text-esi-text-muted"
                    dir="ltr"
                  >
                    {provider.baseUrl}
                  </p>
                  <p className="mt-2 text-[10px] text-esi-text-muted">
                    آزمایش موفق: {formatRelative(provider.testedAt)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        setForm({ ...provider, apiKey: "" });
                        formRef.current?.scrollIntoView({ block: "start" });
                      }}
                    >
                      ویرایش / آزمایش مجدد
                    </Button>
                    {provider.enabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => setDisable(provider)}
                      >
                        غیرفعال‌کردن
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <h3 className="font-bold">دسترسی مربی‌ها و ورزشکاران</h3>
        <p className="mt-2 text-xs leading-6 text-esi-text-muted">
          سهمیه‌ها پیام موفق و پیام در حال پردازش را می‌شمارند؛ روز و ماه بر
          اساس منطقهٔ زمانی کاربر محاسبه می‌شود. تغییر اتصال یا قطع و وصل
          دسترسی، مصرف را صفر نمی‌کند. سقف مدیر: روزانه ۲۰۰ و ماهانه ۵۰۰۰.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(q);
            setPage(1);
          }}
        >
          <Input
            aria-label="جست‌وجوی نام کاربر برای دسترسی AI"
            placeholder="نام کاربر…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
          />
          <Button variant="secondary" type="submit" disabled={loading}>
            جست‌وجو
          </Button>
        </form>
        <div aria-busy={loading} className="mt-4 space-y-3">
          {data?.users.map((user) => (
            <GrantRow
              key={`${user.id}-${user.aiGrant?.updatedAt ?? "new"}`}
              user={user}
              providers={data.providers}
              saved={() => void load()}
            />
          ))}
          {!loading && !data?.users.length && (
            <p className="py-6 text-center text-sm text-esi-text-muted">
              کاربری پیدا نشد.
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            قبلی
          </Button>
          <span className="text-xs text-esi-text-muted">
            صفحهٔ {toPersianDigits(page)} /{" "}
            {toPersianDigits(Math.max(1, Math.ceil((data?.total ?? 0) / 20)))}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || page * 20 >= (data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            بعدی
          </Button>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <div className="flex justify-between">
          <h3 className="font-bold">آخرین پیشنهادها و عملیات همپا</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            تازه‌سازی
          </Button>
        </div>
        <p className="mt-2 text-xs leading-6 text-esi-text-muted">
          جزئیات درخواست، تأییدکننده و وضعیت اجرا ثبت می‌شود. پیشنهاد بدون تأیید
          یا منقضی‌شده اجرا نمی‌شود.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {data?.actions.map((action) => (
            <li key={action.id} className="py-3">
              <p className="text-sm leading-7">{action.preview}</p>
              <p className="mt-1 text-[11px] text-esi-text-muted">
                {action.actor.displayName} ·{" "}
                {actionStatus[action.status] ?? action.status} ·{" "}
                {formatRelative(action.createdAt)}
              </p>
            </li>
          ))}
        </ul>
        {!data?.actions.length && (
          <p className="py-5 text-center text-xs text-esi-text-muted">
            هنوز عملیاتی پیشنهاد نشده است.
          </p>
        )}
      </section>
      <AlertDialog
        open={Boolean(disable)}
        onOpenChange={(open) => {
          if (!open && !saving) setDisable(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>قطع اتصال {disable?.label}</AlertDialogTitle>
          <AlertDialogDescription>
            همهٔ کاربرانی که به این اتصال دسترسی دارند تا فعال‌سازی مجدد
            نمی‌توانند از همپا استفاده کنند. سوابق و سهمیه‌ها حفظ می‌شوند.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>بازگشت</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void deactivate();
              }}
            >
              غیرفعال‌کردن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function GrantRow({
  user,
  providers,
  saved,
}: {
  user: User;
  providers: Provider[];
  saved: () => void;
}) {
  const [grant, setGrant] = React.useState({
    userId: user.id,
    providerId:
      user.aiGrant?.providerId ??
      providers.find((provider) => provider.enabled)?.id ??
      "",
    enabled: user.aiGrant?.enabled ?? false,
    dailyLimit: user.aiGrant?.dailyLimit ?? 20,
    monthlyLimit: user.aiGrant?.monthlyLimit ?? 300,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        setNotice(false);
        try {
          await api("/api/admin/ai", { method: "PATCH", json: grant });
          setNotice(true);
          saved();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-xl border border-border bg-surface-2 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-sm">{user.displayName}</strong>
          <p className="mt-1 text-[10px] text-esi-text-muted">
            {user.role === "coach" ? "مربی" : "ورزشکار"}
            {user.status !== "active" ? " · حساب غیرفعال" : ""} · مصرف امروز{" "}
            {toPersianDigits(user.used)} / این ماه{" "}
            {toPersianDigits(user.monthUsed)}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={grant.enabled}
            onChange={(e) => setGrant({ ...grant, enabled: e.target.checked })}
          />{" "}
          دسترسی فعال
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="space-y-1 text-[11px]">
          <span>اتصال</span>
          <select
            required
            value={grant.providerId}
            onChange={(e) => setGrant({ ...grant, providerId: e.target.value })}
            className={fieldClass}
          >
            <option value="">انتخاب کنید</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
                {!provider.enabled ? " (غیرفعال)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[11px]">
          <span>پیام در روز</span>
          <Input
            type="number"
            min={0}
            max={1000}
            step={1}
            required
            dir="ltr"
            value={grant.dailyLimit}
            onChange={(e) =>
              setGrant({ ...grant, dailyLimit: e.target.valueAsNumber })
            }
          />
        </label>
        <label className="space-y-1 text-[11px]">
          <span>پیام در ماه</span>
          <Input
            type="number"
            min={0}
            max={30000}
            step={1}
            required
            dir="ltr"
            value={grant.monthlyLimit}
            onChange={(e) =>
              setGrant({ ...grant, monthlyLimit: e.target.valueAsNumber })
            }
          />
        </label>
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || !grant.providerId}
          className="self-end"
        >
          {busy ? "در حال ثبت…" : "ذخیره دسترسی"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 text-xs text-primary">
          ذخیره شد
        </p>
      )}
    </form>
  );
}
