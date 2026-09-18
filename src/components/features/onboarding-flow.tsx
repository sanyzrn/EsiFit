"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client/api";
import { parseLocaleNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * Onboarding — 3 concise steps: identity, body metrics, goal.
 * Server computes macro targets (Mifflin-St Jeor) — client never invents them.
 */

const STEPS = ["شما", "بدن شما", "هدف شما"];

const GOALS = [
  { value: "lose_weight", label: "کاهش وزن", desc: "چربی‌سوزی با حفظ عضله", emoji: "🔥" },
  { value: "build_muscle", label: "عضله‌سازی", desc: "حجم و قدرت بیشتر", emoji: "💪" },
  { value: "recomp", label: "ریکامپ", desc: "همزمان چربی کم، عضله بیشتر", emoji: "⚖️" },
  { value: "endurance", label: "استقامت", desc: "قلب و ریه قوی‌تر", emoji: "🏃" },
  { value: "health", label: "سلامت عمومی", desc: "انرژی و تناسب روزمره", emoji: "🌱" },
];

const LEVELS = [
  { value: "beginner", label: "مبتدی", desc: "کمتر از ۶ ماه تمرین منظم" },
  { value: "intermediate", label: "متوسط", desc: "۶ ماه تا ۲ سال" },
  { value: "advanced", label: "پیشرفته", desc: "بیش از ۲ سال" },
];

const ACTIVITY = [
  { value: "sedentary", label: "کم‌تحرک", desc: "کار پشت میز" },
  { value: "light", label: "سبک", desc: "۱–۳ روز فعالیت" },
  { value: "moderate", label: "متوسط", desc: "۳–۵ روز فعالیت" },
  { value: "active", label: "زیاد", desc: "۶–۷ روز فعالیت" },
];

export function OnboardingFlow({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(displayName === "ورزشکار اسی‌فیت" ? "" : displayName);
  const [birthYear, setBirthYear] = React.useState("");
  const [sex, setSex] = React.useState<"male" | "female" | "undisclosed">("male");
  const [height, setHeight] = React.useState("");
  const [weight, setWeight] = React.useState("");
  const [goal, setGoal] = React.useState("build_muscle");
  const [level, setLevel] = React.useState("beginner");
  const [activity, setActivity] = React.useState("moderate");

  const canNext =
    step === 0
      ? name.trim().length >= 2 &&
        (() => {
          const y = parseLocaleNumber(birthYear);
          return y != null && y >= 1300 && y <= 1420;
        })()
      : step === 1
        ? (() => {
            const h = parseLocaleNumber(height);
            const w = parseLocaleNumber(weight);
            return h != null && h >= 100 && h <= 230 && w != null && w >= 30 && w <= 300;
          })()
        : true;

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/onboarding", {
        method: "POST",
        json: {
          displayName: name.trim(),
          birthYear: Math.round(parseLocaleNumber(birthYear)!),
          sexAtBirth: sex,
          heightCm: parseLocaleNumber(height)!,
          weightKg: parseLocaleNumber(weight)!,
          primaryGoal: goal,
          experienceLevel: level,
          activityLevel: activity,
          unitSystem: "metric",
        },
      });
      router.push("/dashboard");
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* progress */}
      <div className="mb-8 flex items-center gap-2" aria-hidden>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-surface-3")} />
          </React.Fragment>
        ))}
      </div>
      <p className="text-xs text-esi-text-muted mb-1">گام {toPersianDigits(step + 1)} از {toPersianDigits(3)}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl border border-border bg-surface-1 p-8 shadow-[var(--shadow-float)]"
        >
          {step === 0 && (
            <>
              <h1 className="text-2xl font-bold">خوش آمدید 👋</h1>
              <p className="mt-2 text-sm text-esi-text-secondary">برای شخصی‌سازی برنامه، چند اطلاعات کوتاه لازم داریم.</p>
              <div className="mt-6 space-y-5">
                <Field label="نام شما" htmlFor="ob-name">
                  <input
                    id="ob-name"
                    className="input-esi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثلاً امیر رضایی"
                    autoFocus
                  />
                </Field>
                <Field label="سال تولد (شمسی)" hint="برای محاسبه دقیق متابولیسم پایه — بین ۱۳۰۰ تا ۱۴۲۰" htmlFor="ob-birth">
                  <input
                    id="ob-birth"
                    className="input-esi"
                    inputMode="numeric"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="۱۳۷۴"
                  />
                </Field>
                <Field label="جنسیت" hint="فقط برای فرمول‌های فیزیولوژیک استفاده می‌شود">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: "male", l: "مرد" },
                      { v: "female", l: "زن" },
                      { v: "undisclosed", l: "ترجیح می‌دهم نگویم" },
                    ].map((o) => (
                      <Chip key={o.v} active={sex === o.v} onClick={() => setSex(o.v as typeof sex)} className={o.v === "undisclosed" ? "col-span-3" : ""}>
                        {o.l}
                      </Chip>
                    ))}
                  </div>
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold">اندازه‌های بدن</h1>
              <p className="mt-2 text-sm text-esi-text-secondary">دقیق وارد کنید؛ بعداً هم قابل ویرایش است.</p>
              <div className="mt-6 space-y-5">
                <Field label="قد (سانتی‌متر)" htmlFor="ob-height">
                  <input id="ob-height" className="input-esi" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="۱۷۸" />
                </Field>
                <Field label="وزن فعلی (کیلوگرم)" htmlFor="ob-weight">
                  <input id="ob-weight" className="input-esi" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="۸۲" />
                </Field>
                <Field label="سطح تمرینی">
                  <div className="space-y-2">
                    {LEVELS.map((l) => (
                      <SelectableCard key={l.value} active={level === l.value} onClick={() => setLevel(l.value)} title={l.label} desc={l.desc} />
                    ))}
                  </div>
                </Field>
                <Field label="فعالیت روزانه خارج از باشگاه">
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIVITY.map((a) => (
                      <Chip key={a.value} active={activity === a.value} onClick={() => setActivity(a.value)}>
                        {a.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold">هدف اصلی شما چیست؟</h1>
              <p className="mt-2 text-sm text-esi-text-secondary">کالری و ماکرو بر همین اساس محاسبه می‌شود.</p>
              <div className="mt-6 space-y-2">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoal(g.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-start transition-all duration-150",
                      goal === g.value ? "border-primary bg-primary/8" : "border-border hover:border-esi-text-muted",
                    )}
                    aria-pressed={goal === g.value}
                  >
                    <span className="text-2xl" aria-hidden>{g.emoji}</span>
                    <span>
                      <span className="block text-sm font-semibold">{g.label}</span>
                      <span className="block text-xs text-esi-text-muted mt-0.5">{g.desc}</span>
                    </span>
                    {goal === g.value && <span className="ms-auto h-2 w-2 rounded-full bg-primary" aria-hidden />}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p role="alert" className="mt-4 text-xs text-destructive">{error}</p>}

          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <Button type="button" variant="ghost" className="h-12 flex-1" onClick={() => setStep((s) => s - 1)}>
                قبلی
              </Button>
            )}
            {step < 2 ? (
              <Button type="button" className="h-12 flex-[2]" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                ادامه
              </Button>
            ) : (
              <Button type="button" className="h-12 flex-[2]" disabled={loading} onClick={() => void submit()}>
                {loading ? "ساخت برنامه شما…" : "شروع کن 🚀"}
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <style jsx global>{`
        .input-esi {
          height: 3rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: var(--surface-2);
          padding-inline: 1rem;
          outline: none;
          transition: border-color 0.15s;
          font-size: 1rem;
        }
        .input-esi:focus {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2" htmlFor={htmlFor}>{label}</label>
      {hint && <span className="mb-2 block text-[11px] text-esi-text-muted">{hint}</span>}
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2.5 text-sm transition-all duration-150",
        active ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-esi-text-secondary hover:border-esi-text-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SelectableCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-start transition-all duration-150",
        active ? "border-primary bg-primary/8" : "border-border hover:border-esi-text-muted",
      )}
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-esi-text-muted mt-0.5">{desc}</span>
      </span>
      {active && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />}
    </button>
  );
}
