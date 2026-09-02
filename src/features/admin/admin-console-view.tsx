"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/layout/app-shell";
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
const TIER_FA: Record<string, string> = { free: "رایگان", vip: "وی‌آی‌پی", vip_plus: "وی‌آی‌پی پلاس", coach: "مربی" };
const STATUS_FA: Record<string, string> = { active: "فعال", suspended: "معلق", deleted: "حذف‌شده" };

export function AdminConsoleView({ adminName }: { adminName: string }) {
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<{ overview: Overview }>("/api/admin/overview")
      .then((d) => setOverview(d.overview))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <div className="max-w-6xl mx-auto w-full pb-6">
      <PageHeader title="کنسول مدیریت" description={`پنل سرپرستی ${adminName} — داده‌های واقعی سیستم`} />

      {error && (
        <div role="alert" className="mx-4 lg:mx-8 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="overview" className="px-4 lg:px-8">
        <TabsList className="mb-5">
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="users">کاربران</TabsTrigger>
          <TabsTrigger value="moderation">مدیریت محتوا</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          {!overview ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 rounded-3xl bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <section aria-label="سنجه‌های کلیدی" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "کل کاربران", value: overview.users, icon: "Users" },
                  { label: "ثبت‌نام ۳۰ روز", value: overview.newUsers30d, icon: "UserPlus" },
                  { label: "تمرین‌های ۷ روز", value: overview.sessions7d, icon: "Dumbbell" },
                  { label: "رکوردهای ۷ روز", value: overview.prs7d, icon: "Trophy" },
                  { label: "پست‌های انجمن", value: overview.posts, icon: "MessageCircle" },
                  { label: "دیدگاه‌ها", value: overview.comments, icon: "MessagesSquare" },
                  { label: "حرکات تمرینی", value: overview.exercises, icon: "ClipboardList" },
                  { label: "مواد غذایی", value: overview.foods, icon: "Apple" },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-3xl border border-border bg-surface-1 p-5"
                  >
                    <Icon name={s.icon} size={18} className="text-primary" />
                    <p className="mt-2 text-2xl font-extrabold tabular-nums">
                      <AnimatedCounter value={s.value} />
                    </p>
                    <p className="mt-0.5 text-[11px] text-esi-text-muted">{s.label}</p>
                  </motion.div>
                ))}
              </section>

              {/* Distribution */}
              <section aria-label="توزیع کاربران" className="grid gap-4 lg:grid-cols-3">
                {[
                  { title: "نقش‌ها", data: overview.usersByRole, fa: ROLE_FA },
                  { title: "سطح اشتراک", data: overview.usersByTier, fa: TIER_FA },
                  { title: "وضعیت", data: overview.usersByStatus, fa: STATUS_FA },
                ].map((group) => {
                  const entries = Object.entries(group.data).filter(([, v]) => v > 0);
                  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
                  return (
                    <div key={group.title} className="rounded-3xl border border-border bg-surface-1 p-5">
                      <h3 className="text-sm font-bold mb-3">{group.title}</h3>
                      <ul className="space-y-2.5">
                        {entries.map(([k, v]) => (
                          <li key={k}>
                            <div className="flex justify-between text-xs mb-1">
                              <span>{group.fa[k] ?? k}</span>
                              <span className="tabular-nums text-esi-text-secondary">{toPersianDigits(v)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round((v / total) * 100)}%` }}
                                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full esi-gradient-brand rounded-full"
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>

              {/* Feature flags */}
              <section aria-label="وضعیت قابلیت‌ها" className="rounded-3xl border border-border bg-surface-1 p-5">
                <h3 className="text-sm font-bold mb-3">قابلیت‌ها (فلگ‌ها)</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(overview.flags).map(([flag, on]) => (
                    <span
                      key={flag}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold",
                        on ? "bg-primary/10 text-primary" : "bg-surface-2 text-esi-text-muted line-through",
                      )}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </section>

              {/* Recent signups */}
              <section aria-label="آخرین ثبت‌نام‌ها" className="rounded-3xl border border-border bg-surface-1 p-5">
                <h3 className="text-sm font-bold mb-3">آخرین ثبت‌نام‌ها</h3>
                <ul className="space-y-2">
                  {overview.recentUsers.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
                      <span className="font-medium truncate flex-1">{u.displayName}</span>
                      <span className="font-mono text-[11px] text-esi-text-muted" dir="ltr">{toPersianDigits(u.phone)}</span>
                      <Badge variant="neutral">{ROLE_FA[u.role] ?? u.role}</Badge>
                      <span className="text-[11px] text-esi-text-muted hidden sm:block">{formatRelative(u.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="moderation">
          <ModerationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const load = React.useCallback((query: string, p: number) => {
    api<{ users: AdminUser[]; total: number }>(`/api/admin/users?q=${encodeURIComponent(query)}&page=${p}`)
      .then((d) => {
        setUsers(d.users);
        setTotal(d.total);
      })
      .catch(() => setUsers([]));
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => {
      load(q, page);
    }, 250);
    return () => clearTimeout(t);
  }, [q, page, load]);

  const update = async (userId: string, patch: Partial<Pick<AdminUser, "role" | "tier" | "status">>) => {
    setSavingId(userId);
    try {
      await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ userId, ...patch }) });
      toast({ title: "ذخیره شد", description: "تغییرات اعمال و کاربر مطلع شد." });
      setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, ...patch } : u)) ?? null);
    } catch (e) {
      toast({ title: "خطا", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const pages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-5">
      <div className="flex items-center gap-3 mb-4">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="جست‌وجو بر اساس نام یا شماره…" className="max-w-xs" aria-label="جست‌وجوی کاربر" />
        <span className="text-xs text-esi-text-muted tabular-nums">{toPersianDigits(total)} کاربر</span>
      </div>

      <div className="space-y-2">
        {users === null && <div className="h-40 rounded-2xl bg-surface-2 animate-pulse" />}
        <AnimatePresence initial={false}>
          {users?.map((u) => (
            <motion.div
              key={u.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-2 sm:grid-cols-[1.4fr_repeat(3,1fr)_auto] items-center rounded-2xl bg-surface-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{u.displayName}</p>
                <p className="text-[11px] text-esi-text-muted font-mono" dir="ltr">{toPersianDigits(u.phone)}</p>
              </div>
              <Select value={u.role} onValueChange={(v) => void update(u.id, { role: v })} disabled={savingId === u.id}>
                <SelectTrigger className="h-9 text-xs" aria-label={`نقش ${u.displayName}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_FA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={u.tier} onValueChange={(v) => void update(u.id, { tier: v })} disabled={savingId === u.id}>
                <SelectTrigger className="h-9 text-xs" aria-label={`اشتراک ${u.displayName}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIER_FA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={u.status} onValueChange={(v) => void update(u.id, { status: v })} disabled={savingId === u.id}>
                <SelectTrigger className={cn("h-9 text-xs", u.status === "suspended" && "text-destructive")} aria-label={`وضعیت ${u.displayName}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_FA).filter(([k]) => k !== "deleted").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-[11px] text-esi-text-muted tabular-nums text-left">
                {toPersianDigits(u.sessions)} تمرین
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {users?.length === 0 && (
          <p className="py-10 text-center text-sm text-esi-text-muted">کاربری با این مشخصات پیدا نشد</p>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
          <span className="text-xs tabular-nums text-esi-text-muted">{toPersianDigits(page)} از {toPersianDigits(pages)}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
        </div>
      )}
    </div>
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
      <section aria-label="پست‌های اخیر" className="rounded-3xl border border-border bg-surface-1 p-5">
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

      <section aria-label="دیدگاه‌های اخیر" className="rounded-3xl border border-border bg-surface-1 p-5">
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
