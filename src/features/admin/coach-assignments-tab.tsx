"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits } from "@/lib/formatting/numbers";

type Coach = { id: string; displayName: string; phone: string };
type Athlete = { id: string; displayName: string; phone: string; tier: string; coachId: string | null };
type Roster = { ok: boolean; coaches: Coach[]; athletes: Athlete[] };

const UNASSIGNED = "unassigned";

export function CoachAssignmentsTab() {
  const [data, setData] = React.useState<Roster | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const result = await api<Roster>("/api/admin/coach-assignments");
      setData(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const assign = async (athleteId: string, choice: string) => {
    if (!data) return;
    const coachId = choice === UNASSIGNED ? null : choice;
    const original = data.athletes.find((athlete) => athlete.id === athleteId)?.coachId;
    if (original === coachId) return;
    setSaving(athleteId);
    try {
      await api("/api/admin/coach-assignments", {
        method: "PUT",
        json: { athleteId, coachId },
      });
      setData((prev) => prev && ({
        ...prev,
        athletes: prev.athletes.map((athlete) =>
          athlete.id === athleteId ? { ...athlete, coachId } : athlete
        ),
      }));
      toast({ title: "مربی ورزشکار ثبت شد", description: coachId ? "تخصیص با موفقیت انجام شد." : "ورزشکار از فهرست مربی خارج شد." });
    } catch (e) {
      toast({ title: "تخصیص انجام نشد", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-2" />)}
    </div>
  );

  if (error) return (
    <div role="alert" className="space-y-3 rounded-2xl border border-destructive/40 bg-surface-1 p-4 text-sm">
      <p className="text-destructive">{error}</p>
      <Button variant="secondary" onClick={() => void load()}>تلاش دوباره</Button>
    </div>
  );

  if (!data) return null;
  const unassigned = data.athletes.filter((athlete) => !athlete.coachId).length;
  return (
    <section aria-label="تخصیص مربی به ورزشکار" className="space-y-4">
      <div className="rounded-3xl border border-border bg-surface-1 p-5">
        <h2 className="text-base font-bold">مربی‌ها و ورزشکاران</h2>
        <p className="mt-1 text-xs leading-6 text-esi-text-secondary">
          هر ورزشکار یک مربی مسئول دارد. فقط مدیر می‌تواند از این بخش مربی را تعیین یا تغییر دهد.
          تغییر مربی، سوابق ورزشی را حذف نمی‌کند.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { name: "مربی فعال", value: data.coaches.length },
            { name: "ورزشکار", value: data.athletes.length },
            { name: "بدون مربی", value: unassigned },
          ].map((item) => (
            <div key={item.name} className="rounded-2xl bg-surface-2 px-3 py-3 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-primary">{toPersianDigits(item.value)}</p>
              <p className="mt-1 text-[11px] text-esi-text-secondary">{item.name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface-1">
        {data.athletes.length === 0 && <p className="p-6 text-center text-sm text-esi-text-muted">هنوز ورزشکاری ثبت‌نام نکرده است.</p>}
        {data.athletes.map((athlete) => (
          <div key={athlete.id} className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold">{athlete.displayName}</p>
              <p className="mt-1 text-[11px] text-esi-text-muted" dir="ltr">{athlete.phone}</p>
              {!athlete.coachId && <span className="mt-1 inline-block text-[11px] text-primary">در انتظار تعیین مربی</span>}
            </div>
            <div className="w-full shrink-0 sm:w-60">
              <Select
                value={athlete.coachId ?? UNASSIGNED}
                onValueChange={(value) => void assign(athlete.id, value)}
                disabled={saving === athlete.id}
              >
                <SelectTrigger className="h-11 w-full bg-surface-2 text-sm" aria-label={`مربی مسئول ${athlete.displayName}`}>
                  <SelectValue placeholder="انتخاب مربی" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>بدون مربی</SelectItem>
                  {data.coaches.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>{coach.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-surface-2 px-4 py-3 text-xs leading-6 text-esi-text-secondary">
        ورزشکار پس از تخصیص، در بخش «ورزشکاران من» مربی انتخاب‌شده دیده می‌شود.
        حساب‌ها و اشتراک‌ها از زبانه «کاربران» مدیریت می‌شوند.
      </div>
    </section>
  );
}
