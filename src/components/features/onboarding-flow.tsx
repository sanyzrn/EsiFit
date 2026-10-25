"use client";
import { safeReturnPath } from "@/lib/auth/return-path";

import * as React from "react";
import { TrainingPlanner } from "@/features/planning/training-planner";
import { toJalali } from "@/lib/dates/jalali";
import { parseAvailableEquipment } from "@/lib/workout/equipment";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client/api";
import { clearLocalOnboardingState } from "@/lib/offline/adapter";
import { parseLocaleNumber, toPersianDigits } from "@/lib/formatting/numbers";
import { cn } from "@/lib/utils";

/**
 * Onboarding — 3 concise steps: identity, body metrics, goal.
 * Server computes macro targets (Mifflin-St Jeor) — client never invents them.
 */

const STEPS = ["شما", "بدن شما", "هدف شما", "شرایط تمرین"];
export type OnboardingProfile = { birthYear:number|null;sexAtBirth:string|null;heightCm:number|null;weightKg:number|null;primaryGoal:string|null;experienceLevel:string|null;activityLevel:string|null;availableEquipment:string;weeklyWorkoutTarget:number;workoutMinutes:number;medicalReviewRequired:boolean;healthNotes:string };

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

const EQUIPMENT_OPTIONS = [
  { value: "barbell", label: "هالتر" },
  { value: "dumbbell", label: "دمبل" },
  { value: "machine", label: "دستگاه" },
  { value: "cable", label: "سیم‌کش" },
  { value: "bodyweight", label: "وزن بدن" },
  { value: "kettlebell", label: "کتل‌بل" },
  { value: "band", label: "کش" },
  { value: "cardio", label: "کاردیو" },
];

export function OnboardingFlow({ displayName, returnTo, initialProfile }: { displayName: string; returnTo?: string | null; initialProfile?:OnboardingProfile }) {
  const router = useRouter();
  const cleanupPromise = React.useRef<Promise<void> | null>(null);
  const ensureFreshOfflineState = React.useCallback(() => {
    if (!cleanupPromise.current) cleanupPromise.current = initialProfile ? Promise.resolve() : clearLocalOnboardingState();
    return cleanupPromise.current;
  }, [initialProfile]);
  React.useEffect(() => { void ensureFreshOfflineState(); }, [ensureFreshOfflineState]);
  const [saved, setSaved] = React.useState(false);
  const [days,setDays]=React.useState(initialProfile?.weeklyWorkoutTarget??3);
  const [minutes,setMinutes]=React.useState(initialProfile?.workoutMinutes??45);
  const [medical,setMedical]=React.useState(initialProfile?.medicalReviewRequired??false);
  const [notes,setNotes]=React.useState(initialProfile?.healthNotes??"");
  const [hasPain,setHasPain]=React.useState(false);
  const [region,setRegion]=React.useState("knee");
  const [severity,setSeverity]=React.useState(3);
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(displayName === "ورزشکار اسی‌فیت" ? "" : displayName);
  const [birthYear, setBirthYear] = React.useState(initialProfile?.birthYear?.toString()??"");
  const [sex, setSex] = React.useState<"male" | "female" | "undisclosed">((initialProfile?.sexAtBirth as "male"|"female"|"undisclosed")??"undisclosed");
  const [height, setHeight] = React.useState(initialProfile?.heightCm?.toString()??"");
  const [weight, setWeight] = React.useState(initialProfile?.weightKg?.toString()??"");
  const [goal, setGoal] = React.useState(initialProfile?.primaryGoal??"build_muscle");
  const [level, setLevel] = React.useState(initialProfile?.experienceLevel??"beginner");
  const [activity, setActivity] = React.useState(initialProfile?.activityLevel??"moderate");
  /** Empty set = full gym (unrestricted). */
  const [equipment, setEquipment] = React.useState<string[]>([...(parseAvailableEquipment(initialProfile?.availableEquipment)??[])]);
  const [fullGym, setFullGym] = React.useState(!parseAvailableEquipment(initialProfile?.availableEquipment));

  const toggleEquipment = (key: string) => {
    setFullGym(false);
    setEquipment((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const canNext =
    step === 0
      ? name.trim().length >= 2 &&
        (() => {
          const y = parseLocaleNumber(birthYear);
          return y != null && y >= 1300 && y <= toJalali(new Date()).jy-10;
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
      await ensureFreshOfflineState();
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
          availableEquipment: fullGym ? [] : equipment,
          weeklyWorkoutTarget: days,workoutMinutes:minutes,medicalReviewRequired:medical,healthNotes:notes,
          ...(hasPain?{injury:{bodyRegion:region,severity,note:notes.slice(0,280)}}:{}),
        },
      });
      setSaved(true);setLoading(false);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  if(saved)return <div className="w-full max-w-3xl space-y-5"><div className="text-center"><h1 className="text-2xl font-bold">پرونده آماده است؛ حالا برنامهٔ خودت</h1><p className="mt-3 text-sm leading-7 text-esi-text-secondary">برنامه‌ریز شرایطت را بررسی می‌کند. اگر هوش در دسترس نبود، پیشنهاد پایه یا بررسی مربی داریم؛ برنامهٔ قبلی بی‌اجازه تغییر نمی‌کند.</p></div><TrainingPlanner/><Button variant="secondary" className="w-full" onClick={()=>router.replace(safeReturnPath(returnTo)??"/workouts")}>ورود به فضای من؛ ادامهٔ برنامه‌ریزی بعداً</Button></div>;

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
      <p className="text-xs text-esi-text-muted mb-1">گام {toPersianDigits(step + 1)} از {toPersianDigits(STEPS.length)}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="esi-card rounded-3xl p-8 shadow-[var(--shadow-float)]"
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
                <Field label="سال تولد (شمسی)" hint="سال تولد شمسی؛ سن تقریبی از آن محاسبه می‌شود" htmlFor="ob-birth">
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
                <Field
                  label="وسایل در دسترس"
                  hint="برنامه تمرینی بر همین اساس شخصی‌سازی می‌شود"
                >
                  <div className="space-y-2">
                    <Chip
                      active={fullGym}
                      onClick={() => {
                        setFullGym(true);
                        setEquipment([]);
                      }}
                      className="w-full"
                    >
                      باشگاه کامل (بدون محدودیت)
                    </Chip>
                    {!fullGym && (
                      <div className="grid grid-cols-2 gap-2">
                        {EQUIPMENT_OPTIONS.map((eq) => (
                          <Chip key={eq.value} active={equipment.includes(eq.value)} onClick={() => toggleEquipment(eq.value)}>
                            {eq.label}
                          </Chip>
                        ))}
                      </div>
                    )}
                    {fullGym && (
                      <button
                        type="button"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                        onClick={() => setFullGym(false)}
                      >
                        فقط وسایل خانه/باشگاه محدود دارم
                      </button>
                    )}
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

          {step === 3 && <>
            <h1 className="text-2xl font-bold">تمرین باید در زندگی تو جا شود</h1>
            <div className="mt-5 space-y-5">
              <Field label="چند روز در هفته وقت داری؟" htmlFor="ob-days"><select id="ob-days" value={days} onChange={e=>setDays(Number(e.target.value))} className="input-esi">{[2,3,4,5,6].map(n=><option key={n} value={n}>{toPersianDigits(n)} روز</option>)}</select><p className="mt-2 text-xs leading-6 text-esi-text-muted">برنامهٔ خودکار برای مبتدی حداکثر ۳ و سطح متوسط حداکثر ۴ جلسه در نظر می‌گیرد؛ برنامهٔ تخصصی با مربی تنظیم می‌شود.</p></Field>
              <Field label="زمان هر جلسه" htmlFor="ob-minutes"><select id="ob-minutes" value={minutes} onChange={e=>setMinutes(Number(e.target.value))} className="input-esi">{[20,30,45,60,75,90].map(n=><option key={n} value={n}>{toPersianDigits(n)} دقیقه</option>)}</select></Field>
              <label className="flex min-h-11 items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2" checked={hasPain} onChange={e=>setHasPain(e.target.checked)}/>درد یا مصدومیت فعال دارم و باید در پرونده ثبت شود.</label>
              {hasPain&&<div className="space-y-3"><Field label="ناحیهٔ درد" htmlFor="ob-pain"><select id="ob-pain" className="input-esi" value={region} onChange={e=>setRegion(e.target.value)}>{Object.entries({knee:"زانو",shoulder:"سرشانه",lower_back:"کمر",elbow:"آرنج",wrist:"مچ",hip:"لگن",ankle:"قوزک پا",neck:"گردن",groin:"کشاله ران",ribs:"دنده",other:"سایر"}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="شدت فعلی درد از ۱ تا ۱۰" htmlFor="ob-severity"><input id="ob-severity" className="input-esi" type="number" min={1} max={10} value={severity} onChange={e=>setSeverity(Number(e.target.value))}/></Field></div>}
              <label className="flex min-h-11 items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2" checked={medical} onChange={e=>setMedical(e.target.checked)}/>محدودیت پزشکی، بارداری/پس از زایمان یا شرایط خاصی دارم که ورزش باید با نظر متخصص تنظیم شود.</label>
              <Field label="توضیح محدودیت‌ها برای مربی (اختیاری)" htmlFor="ob-notes"><textarea id="ob-notes" className="input-esi min-h-24 py-3" maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
              <p className="text-xs leading-7 text-esi-text-muted">دردهای قبلاً ثبت‌شده تا زمان تعیین وضعیتشان در بخش تمرین، در پرونده باقی می‌مانند. برنامه‌ریز عمومی برای تشخیص یا درمان مصدومیت نیست.</p>
            </div>
          </>}

          {error && <p role="alert" className="mt-4 text-xs text-destructive">{error}</p>}

          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <Button type="button" variant="ghost" className="h-12 flex-1" onClick={() => setStep((s) => s - 1)}>
                قبلی
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" className="h-12 flex-[2]" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                ادامه
              </Button>
            ) : (
              <Button type="button" className="h-12 flex-[2]" disabled={loading || (!fullGym && equipment.length===0) || (hasPain && (severity<1||severity>10))} onClick={() => void submit()}>
                {loading ? "ذخیرهٔ پرونده…" : "ذخیره و رفتن به برنامه‌ریز"}
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
