"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits } from "@/lib/formatting/numbers";
import { AI_COACH_ID } from "@/lib/coach/ai-coach";
import { cn } from "@/lib/utils";

type Coach = {
  id: string;
  displayName: string;
  phone?: string;
  type: "human" | "ai";
  status: "active" | "reserved";
  description?: string;
};
type Athlete = { id: string; displayName: string; phone: string; tier: string; coachId: string | null };
type Roster = { ok: boolean; coaches: Coach[]; athletes: Athlete[] };
type Filter = "all" | "unassigned" | "human" | "ai";

const NONE = "unassigned";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "همه" },
  { id: "unassigned", label: "بدون مربی" },
  { id: "human", label: "مربی انسانی" },
  { id: "ai", label: "مربی AI" },
];
const TIER: Record<string, string> = { free: "رایگان", vip: "VIP", vip_plus: "VIP Plus" };

export function CoachAssignmentsTab() {
  const [data, setData] = React.useState<Roster | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setData(await api<Roster>("/api/admin/coach-assignments"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const assign = async (athleteId: string, choice: string) => {
    if (!data || saving) return;
    const coachId = choice === NONE ? null : choice;
    const original = data.athletes.find((a) => a.id === athleteId)?.coachId;
    if (original === coachId) return;
    setSaving(athleteId);
    try {
      await api("/api/admin/coach-assignments", {
        method: "PUT", json: { athleteId, coachId },
      });
      setData((prev) => prev && ({
        ...prev,
        athletes: prev.athletes.map((a) => a.id === athleteId ? { ...a, coachId } : a),
      }));
      toast({
        title: coachId === AI_COACH_ID ? "مربی AI رزرو شد" : coachId ? "مربی تعیین شد" : "تخصیص حذف شد",
        description: coachId === AI_COACH_ID
          ? "موتور AI هنوز فعال نیست؛ فعلاً برنامه خودکار ارسال نمی‌شود."
          : "رابطه مربی و ورزشکار ثبت شد؛ سوابق تمرینی حفظ شده‌اند.",
      });
    } catch (e) {
      toast({ title: "ذخیره نشد", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return (
    <div className="space-y-3" role="status" aria-label="در حال دریافت مربی‌ها و ورزشکاران">
      <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />)}
    </div>
  );
  if (error) return (
    <div role="alert" className="rounded-2xl border border-destructive/40 bg-surface-1 p-5 text-sm">
      <p className="mb-3 text-destructive">{error}</p>
      <Button variant="secondary" onClick={() => void load()}>تلاش دوباره</Button>
    </div>
  );
  if (!data) return null;

  const ai = data.coaches.find((coach) => coach.id === AI_COACH_ID);
  const human = data.coaches.filter((coach) => coach.type === "human");
  const used = data.athletes.filter((a) => a.coachId);
  const unassigned = data.athletes.length - used.length;
  const aiAssigned = data.athletes.filter((a) => a.coachId === AI_COACH_ID).length;
  const visible = data.athletes.filter((a) => {
    if (filter === "unassigned" && a.coachId) return false;
    if (filter === "human" && (!a.coachId || a.coachId === AI_COACH_ID)) return false;
    if (filter === "ai" && a.coachId !== AI_COACH_ID) return false;
    return !query.trim() || `${a.displayName} ${a.phone}`.includes(query.trim());
  });
  const byId = new Map(data.coaches.map((coach) => [coach.id, coach]));

  return (
    <section aria-label="مدیریت تخصیص مربی" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "ورزشکار", value: data.athletes.length, icon: "Users" },
          { label: "مربی انسانی", value: human.length, icon: "UserRound" },
          { label: "بدون مربی", value: unassigned, icon: "UserPlus" },
          { label: "زیر نظر AI", value: aiAssigned, icon: "Sparkles" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-surface-1 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2 text-esi-text-muted">
              <span className="text-[11px]">{stat.label}</span>
              <Icon name={stat.icon} size={16} />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-esi-text-primary">{toPersianDigits(stat.value)}</p>
          </div>
        ))}
      </div>

      {ai && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Icon name="Sparkles" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold">{ai.displayName}</p>
              <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-medium text-primary">آزمایشی</span>
            </div>
            <p className="mt-1 text-xs leading-6 text-esi-text-secondary">
              گزینه AI در فهرست مربیان قابل تخصیص است؛ موتور برنامه‌نویسی تمرین و دسترسی به اطلاعات خصوصی هنوز فعال نشده.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface-1">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">ورزشکاران و مربی مسئول</h2>
              <p className="mt-1 text-xs text-esi-text-muted">فقط یک مربی مسئول برای هر ورزشکار</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={saving !== null} aria-label="به‌روزرسانی فهرست">
              <Icon name="RefreshCw" size={15} />
              به‌روزرسانی
            </Button>
          </div>
          <Input
            aria-label="جستجوی ورزشکار"
            placeholder="جستجوی نام یا شماره ورزشکار…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full bg-surface-2"
          />
          <div className="flex flex-wrap gap-1.5" aria-label="فیلتر مربی ورزشکار">
            {FILTERS.map((item) => (
              <button
                key={item.id} type="button" onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={cn(
                  "min-h-10 rounded-xl border px-3 text-xs font-medium transition-colors",
                  filter === item.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-surface-2 text-esi-text-secondary hover:border-primary/50",
                )}
              >{item.label}</button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-esi-text-muted">
            {data.athletes.length ? "ورزشکاری با این فیلتر پیدا نشد." : "هنوز ورزشکاری ثبت‌نام نکرده."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((athlete) => {
              const current = athlete.coachId ? byId.get(athlete.coachId) : null;
              return (
                <li key={athlete.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-bold text-esi-text-primary">
                      {athlete.displayName.trim().charAt(0) || "؟"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{athlete.displayName}</p>
                      <p className="mt-0.5 text-[11px] text-esi-text-muted" dir="ltr">{athlete.phone}</p>
                    </div>
                    <span className="me-auto shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-[10px] text-esi-text-secondary sm:me-0">
                      {TIER[athlete.tier] ?? "رایگان"}
                    </span>
                  </div>
                  <div className="min-w-0 w-full sm:w-64">
                    <Select
                      value={athlete.coachId ?? NONE}
                      onValueChange={(value) => void assign(athlete.id, value)}
                      disabled={saving !== null}
                    >
                      <SelectTrigger aria-label={`مربی مسئول ${athlete.displayName}`} className="h-11 w-full border-border bg-surface-2 text-xs">
                        <SelectValue placeholder="تعیین مربی" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>بدون مربی</SelectItem>
                        {human.map((coach) => (
                          <SelectItem key={coach.id} value={coach.id}>{coach.displayName}</SelectItem>
                        ))}
                        {ai && <SelectItem value={AI_COACH_ID}>مربی هوشمند EsiFit (آزمایشی)</SelectItem>}
                      </SelectContent>
                    </Select>
                    <p className={cn("mt-1 text-[10px]", current?.type === "ai" ? "text-primary" : "text-esi-text-muted")}>
                      {saving === athlete.id ? "در حال ذخیره…" : current ? current.type === "ai" ? "رزرو شده؛ برنامه هوشمند هنوز غیرفعال است" : "مربی انسانی فعال" : "در انتظار مربی"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
