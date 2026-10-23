"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
import { CoachAssignmentsTab } from "@/features/admin/coach-assignments-tab";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { formatRelative } from "@/lib/dates/jalali";
import { cn } from "@/lib/utils";

type Overview = {
  users: number;
  usersByRole: Record<string, number>;
  usersByTier: Record<string, number>;
  usersByStatus: Record<string, number>;
  sessions7d: number;
  newUsers30d: number;
  posts: number;
  comments: number;
  exercises: number;
  foods: number;
  prs7d: number;
  activeSessions: number;
  recentUsers: Array<{ id: string; displayName: string; phone: string; role: string; tier: string; status: string; createdAt: string }>;
  flags: Record<string, boolean>;
};

type AdminUser = {
  id: string;
  phone: string;
  displayName: string;
  role: string;
  tier: string;
  status: string;
  createdAt: string;
  sessions: number;
};

type Moderation = {
  posts: Array<{ id: string; content: string; author: string; authorRole: string; createdAt: string; likeCount: number; commentCount: number }>;
  comments: Array<{ id: string; content: string; author: string; authorRole: string; createdAt: string; postExcerpt: string }>;
};

const ROLE_FA: Record<string, string> = { member: "ورزشکار", coach: "مربی", admin: "مدیر" };
const TIER_FA: Record<string, string> = { free: "رایگان", vip: "وی‌آی‌پی", vip_plus: "وی‌آی‌پی پلاس" };
const STATUS_FA: Record<string, string> = { active: "فعال", suspended: "معلق", deleted: "حذف‌شده" };

export function AdminConsoleView({ adminName }: { adminName: string }) {
  const [tab, setTab] = React.useState("overview");
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadOverview = React.useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const res = await api<{ overview: Overview }>("/api/admin/overview");
      setOverview(res.overview);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void loadOverview(); }, [loadOverview]);

  const athletes = overview?.usersByRole.member ?? 0;
  const coaches = overview?.usersByRole.coach ?? 0;
  const humanNav = [
    { value: "overview", label: "نمای کلی", icon: "LayoutDashboard" },
    { value: "coaches", label: "مربی‌ها و ورزشکاران", icon: "Users" },
    { value: "users", label: "مدیریت حساب‌ها", icon: "UserPlus" },
    { value: "moderation", label: "محتوا", icon: "ShieldCheck" },
  ];
  const metrics = [
    { label: "ورزشکاران", count: athletes, icon: "Users", hint: "حساب ورزشکار" },
    { label: "مربیان انسانی", count: coaches, icon: "UserRound", hint: "حساب مربی" },
    { label: "ثبت‌نام ۳۰ روز", count: overview?.newUsers30d ?? 0, icon: "UserPlus", hint: "کاربران جدید" },
    { label: "جلسات فعال", count: overview?.activeSessions ?? 0, icon: "Activity", hint: "جلسات ورزشکاران" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      <div className="px-4 pt-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
              <Icon name="ShieldCheck" size={15} />
              پنل مدیریت اسی‌فیت
            </p>
            <h1 className="font-display text-3xl leading-tight lg:text-4xl">مرکز مدیریت</h1>
            <p className="mt-1 text-xs leading-6 text-esi-text-secondary sm:text-sm">
              مدیریت مربی‌ها، ورزشکاران و محتوای سایت
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-xs text-esi-text-secondary">
            <Icon name="Shield" size={16} className="text-primary" />
            <span className="max-w-36 truncate">{adminName}</span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-5 px-4 lg:px-8">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl border border-border bg-surface-1 p-1.5 sm:grid-cols-4">
          {humanNav.map((item) => (
            <TabsTrigger
              key={item.value} value={item.value}
              className="flex h-11 min-w-0 gap-1.5 rounded-xl px-2 text-xs data-[state=active]:border-primary/30 data-[state=active]:bg-surface-3 data-[state=active]:text-primary sm:text-sm"
            >
              <Icon name={item.icon} size={16} />
              <span className="truncate">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {error ? (
            <div role="alert" className="rounded-2xl border border-destructive/30 bg-surface-1 p-5 text-sm text-destructive">
              <p>{error}</p>
              <Button variant="secondary" className="mt-3" onClick={() => void loadOverview()}>تلاش دوباره</Button>
            </div>
          ) : loading || !overview ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="در حال بارگذاری آمار">
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />)}
            </div>
          ) : (
            <>
              <section aria-label="آمار مدیریت" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-border bg-surface-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-esi-text-secondary">{metric.label}</span>
                      <Icon name={metric.icon} size={17} className="text-primary" />
                    </div>
                    <div className="mt-3 text-3xl font-bold tabular-nums text-esi-text-primary">
                      <AnimatedCounter value={metric.count} />
                    </div>
                    <p className="mt-1 text-[10px] text-esi-text-muted">{metric.hint}</p>
                  </div>
                ))}
              </section>

              <button
                type="button" onClick={() => setTab("coaches")}
                className="flex min-h-20 w-full items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-start transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon name="Users" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">تعیین مربی ورزشکاران</p>
                  <p className="mt-1 text-xs leading-5 text-esi-text-secondary">
                    ارتباط مربی انسانی یا AI با هر ورزشکار را مدیریت کن.
                  </p>
                </div>
                <Icon name="ChevronLeft" size={18} className="shrink-0 text-primary" />
              </button>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <section className="overflow-hidden rounded-2xl border border-border bg-surface-1">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
                    <h2 className="text-sm font-bold">آخرین ثبت‌نام‌ها</h2>
                    <button type="button" className="text-xs text-primary" onClick={() => setTab("users")}>همه کاربران</button>
                  </div>
                  {overview.recentUsers.filter((u) => u.role !== "admin").length ? (
                    <ul className="divide-y divide-border">
                      {overview.recentUsers.filter((u) => u.role !== "admin").slice(0, 5).map((u) => (
                        <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xs font-bold">
                            {u.displayName.trim().charAt(0) || "؟"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{u.displayName}</p>
                            <p className="mt-1 text-[10px] text-esi-text-muted">{formatRelative(u.createdAt)}</p>
                          </div>
                          <Badge variant="neutral">{ROLE_FA[u.role] ?? u.role}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-8 text-center text-xs text-esi-text-muted">ثبت‌نامی برای نمایش وجود ندارد.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-surface-1 p-4">
                  <h2 className="text-sm font-bold">وضعیت سیستم</h2>
                  <p className="mt-1 text-xs text-esi-text-muted">نمای مدیریتی، نه داشبورد ورزشی</p>
                  <div className="mt-4 space-y-2.5">
                    {[
                      { label: "کل ورزشکاران", value: athletes },
                      { label: "مربیان", value: coaches },
                      { label: "پست‌های انجمن", value: overview.posts },
                      { label: "دیدگاه‌ها", value: overview.comments },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-xs">
                        <span className="text-esi-text-secondary">{item.label}</span>
                        <strong className="tabular-nums">{toPersianDigits(item.value)}</strong>
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary" className="mt-3 h-11 w-full" onClick={() => setTab("moderation")}>
                    مدیریت محتوای انجمن
                  </Button>
                </section>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="coaches"><CoachAssignmentsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="moderation"><ModerationTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (q: string, p: number) => {
    try {
      setError(null);
      const result = await api<{ users: AdminUser[]; total: number }>(
        `/api/admin/users?q=${encodeURIComponent(q)}&page=${p}`
      );
      setUsers(result.users);
      setTotal(result.total);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => { void load(query, page); }, 250);
    return () => window.clearTimeout(timer);
  }, [query, page, load]);

  const update = async (userId: string, patch: Partial<Pick<AdminUser, "role" | "tier" | "status">>) => {
    if (savingId) return;
    setSavingId(userId);
    try {
      const result = await api<{ user: Pick<AdminUser, "id" | "role" | "tier" | "status"> }>(
        "/api/admin/users", { method: "PATCH", json: { userId, ...patch } }
      );
      setUsers((prev) => prev?.map((u) => u.id === userId ? { ...u, ...result.user } : u) ?? null);
      toast({ title: "تغییرات حساب ذخیره شد", description: "نقش و دسترسی از اشتراک جدا هستند." });
    } catch (e) {
      toast({ title: "تغییر اعمال نشد", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const pages = Math.max(1, Math.ceil(total / 12));
  return (
    <section aria-label="حساب‌های مربیان و ورزشکاران" className="overflow-hidden rounded-2xl border border-border bg-surface-1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-bold">حساب‌های کاربری</h2>
          <p className="mt-1 text-xs text-esi-text-muted">فقط ورزشکاران و مربیان؛ حساب مدیر در این فهرست نیست.</p>
        </div>
        <span className="rounded-xl bg-surface-2 px-3 py-2 text-xs tabular-nums text-esi-text-secondary">
          {toPersianDigits(total)} حساب
        </span>
        <Input
          aria-label="جستجوی کاربر"
          value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="نام یا شماره تلفن…"
          className="h-11 w-full bg-surface-2 sm:max-w-sm"
        />
      </div>
      {error && (
        <div role="alert" className="m-4 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => void load(query, page)}>
            تلاش مجدد
          </Button>
        </div>
      )}
      {users === null ? (
        <div className="space-y-3 p-4" role="status" aria-label="در حال دریافت کاربران">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-2" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="p-8 text-center text-sm text-esi-text-muted">کاربری با این مشخصات پیدا نشد.</p>
      ) : (
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-bold">
                  {u.displayName.trim().charAt(0) || "؟"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{u.displayName}</p>
                  <p className="mt-0.5 text-[11px] text-esi-text-muted" dir="ltr">{toPersianDigits(u.phone)}</p>
                </div>
                <Badge variant="neutral">{ROLE_FA[u.role] ?? u.role}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                <label className="min-w-0">
                  <span className="mb-1.5 block text-[11px] text-esi-text-muted">نقش حساب</span>
                  <Select value={u.role} onValueChange={(value) => void update(u.id, { role: value })} disabled={savingId !== null}>
                    <SelectTrigger className="h-10 w-full border-border bg-surface-2 text-xs" aria-label={`نقش ${u.displayName}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">ورزشکار</SelectItem>
                      <SelectItem value="coach">مربی</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="min-w-0">
                  <span className="mb-1.5 block text-[11px] text-esi-text-muted">وضعیت</span>
                  <Select value={u.status} onValueChange={(value) => void update(u.id, { status: value })} disabled={savingId !== null}>
                    <SelectTrigger className="h-10 w-full border-border bg-surface-2 text-xs" aria-label={`وضعیت ${u.displayName}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="suspended">معلق</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                {u.role === "member" ? (
                  <label className="col-span-2 min-w-0 lg:col-span-1">
                    <span className="mb-1.5 block text-[11px] text-esi-text-muted">اشتراک ورزشکار</span>
                    <Select value={u.tier === "coach" ? "free" : u.tier} onValueChange={(value) => void update(u.id, { tier: value })} disabled={savingId !== null}>
                      <SelectTrigger className="h-10 w-full border-border bg-surface-2 text-xs" aria-label={`اشتراک ${u.displayName}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIER_FA).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ) : (
                  <div className="col-span-2 flex items-end lg:col-span-1">
                    <p className="w-full rounded-xl bg-surface-2 px-3 py-2.5 text-[11px] text-esi-text-secondary">
                      مربی اشتراک ورزشی ندارد.
                    </p>
                  </div>
                )}
              </div>
              {savingId === u.id && <p className="mt-2 text-xs text-primary" role="status">در حال ذخیره تغییرات…</p>}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
          <span className="text-xs text-esi-text-muted tabular-nums">
            صفحه {toPersianDigits(page)} از {toPersianDigits(pages)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
        </div>
      )}
    </section>
  );
}

function ModerationTab() {
  const { toast } = useToast();
  const [data, setData] = React.useState<Moderation | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api<Moderation>("/api/admin/moderation")
      .then(setData)
      .catch(() => setData({ posts: [], comments: [] }));
  }, []);

  React.useEffect(load, [load]);

  const remove = async (kind: "post" | "comment", id: string) => {
    setRemoving(id);
    try {
      await api("/api/admin/moderation", { method: "DELETE", body: JSON.stringify({ kind, id, reason: "نقض قوانین انجمن" }) });
      toast({ title: "حذف شد", description: "محتوا حذف و نویسنده مطلع شد." });
      setData((prev) =>
        prev
          ? {
              posts: prev.posts.filter((p) => !(kind === "post" && p.id === id)),
              comments: prev.comments.filter((c) => !(kind === "comment" && c.id === id)),
            }
          : prev,
      );
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="پست‌های اخیر" className="esi-card rounded-3xl p-5">
        <h3 className="text-sm font-bold mb-3">پست‌های اخیر</h3>
        <ul className="space-y-2">
          {data?.posts.map((p) => (
            <li key={p.id} className="rounded-2xl bg-surface-2 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-esi-text-muted mb-1.5">
                <span className="font-semibold text-esi-text-secondary">{p.author}</span>
                {p.authorRole !== "member" && <Badge variant="neutral">{ROLE_FA[p.authorRole]}</Badge>}
                <span className="ms-auto">{formatRelative(p.createdAt)}</span>
              </div>
              <p className="text-sm leading-6">{p.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-esi-text-muted tabular-nums">
                  {toPersianDigits(p.likeCount)} پسند • {toPersianDigits(p.commentCount)} دیدگاه
                </span>
                <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => void remove("post", p.id)} disabled={removing === p.id}>
                  <Icon name="Trash2" size={14} />
                  حذف
                </Button>
              </div>
            </li>
          ))}
          {data?.posts.length === 0 && <li className="py-8 text-center text-sm text-esi-text-muted">پستی نیست</li>}
        </ul>
      </section>

      <section aria-label="دیدگاه‌های اخیر" className="esi-card rounded-3xl p-5">
        <h3 className="text-sm font-bold mb-3">دیدگاه‌های اخیر</h3>
        <ul className="space-y-2">
          {data?.comments.map((c) => (
            <li key={c.id} className="rounded-2xl bg-surface-2 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-esi-text-muted mb-1.5">
                <span className="font-semibold text-esi-text-secondary">{c.author}</span>
                <span className="ms-auto">{formatRelative(c.createdAt)}</span>
              </div>
              <p className="text-sm leading-6">{c.content}</p>
              <p className="text-[10px] text-esi-text-muted mt-1 truncate">در پاسخ به: {c.postExcerpt}</p>
              <div className="flex justify-end mt-1.5">
                <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => void remove("comment", c.id)} disabled={removing === c.id}>
                  <Icon name="Trash2" size={14} />
                  حذف
                </Button>
              </div>
            </li>
          ))}
          {data?.comments.length === 0 && <li className="py-8 text-center text-sm text-esi-text-muted">دیدگاهی نیست</li>}
        </ul>
      </section>
    </div>
  );
}
