"use client";
import { normalizePersianSearch } from "@/lib/formatting/search";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PLAN_PRESETS, type PlanTemplateKey } from "@/lib/workout/plan-presets";
import { PLAN_TEMPLATE_LABELS } from "@/lib/workout/plan-titles";
import { coachProgramInput, type CoachProgramDraft, type CoachExerciseOption, type CoachActivePlan } from "@/lib/coach/program-contract";
import { parseAvailableEquipment, EQUIPMENT_LABEL_FA, type EquipmentKey } from "@/lib/workout/equipment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits } from "@/lib/formatting/numbers";

const GOALS = { build_muscle: "عضله‌سازی", lose_weight: "کاهش وزن", endurance: "استقامت", health: "سلامت عمومی", recomp: "بازترکیب بدنی" };
function fromPreset(key: PlanTemplateKey): CoachProgramDraft {
  const p = PLAN_PRESETS[key];
  return { name: p.name, description: p.description, goalType: "health", weeks: 4, days: structuredClone(p.days) };
}
function copyActive(plan: CoachActivePlan): CoachProgramDraft {
  const copy = structuredClone(plan); const days = copy.days.slice(0,7);
  while (days.length < 7) days.push({ name: "استراحت", focusRegion: "recovery", isRest: true, exercises: [] });
  return { ...copy, days };
}
export function ProgramEditor({ athleteId, activePlan, catalog, equipment: rawEquipment }: { athleteId: string; activePlan: CoachActivePlan | null; catalog: CoachExerciseOption[]; equipment: string }) {
  const router = useRouter();
  const [preset, setPreset] = React.useState<PlanTemplateKey>("full_body_3");
  const [draft, setDraft] = React.useState<CoachProgramDraft>(() => activePlan ? copyActive(activePlan) : fromPreset("full_body_3"));
  const [sourceId, setSourceId] = React.useState(activePlan?.id ?? null);
  const [query, setQuery] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState("");
  const equipment = parseAvailableEquipment(rawEquipment);
  const available = catalog.filter(x => !equipment || equipment.has(x.equipment));
  const unavailable = draft.days.flatMap(d => d.exercises).filter(e => !available.some(x => x.slug === e.slug));
  const data = { athleteId, sourcePlanId: sourceId, name: draft.name, description: draft.description, goalType: draft.goalType, weeks: draft.weeks, days: draft.days };
  const validation = coachProgramInput.safeParse(data);
  const issue = validation.success ? null : validation.error.issues[0];
  const issueLabels: Record<string,string> = { name:"نام برنامه", weeks:"طول دوره", description:"توضیحات", sets:"تعداد ست", repsMin:"حداقل تکرار", repsMax:"حداکثر تکرار", rpe:"فشار تمرین", rest:"استراحت", note:"یادداشت", days:"روزهای برنامه" };
  const issueLocation = issue?.path[0] === "days" ? `روز ${toPersianDigits(Number(issue.path[1])+1)}${issue.path[2] === "exercises" ? `، حرکت ${toPersianDigits(Number(issue.path[3])+1)}` : ""}: ` : "";
  const issueMessage = issue ? issueLocation + (issue.code === "custom" ? issue.message : `مقدار «${issueLabels[String(issue.path.at(-1))] ?? "اطلاعات برنامه"}» را در بازهٔ مشخص‌شده وارد کن.`) : "";
  const dayCount = draft.days.filter(d => !d.isRest).length;
  const patchDay = (index: number, update: Partial<CoachProgramDraft["days"][number]>) => setDraft(p => ({ ...p, days: p.days.map((d,i) => i === index ? { ...d, ...update } : d) }));
  const save = async () => {
    setBusy(true); setError("");
    try {
      const result = await api<{ planId: string }>("/api/coach/program", { method: "POST", json: data });
      setSourceId(result.planId); setSaved("برنامه از امروز فعال شد و ورزشکار اعلان دریافت کرد."); setConfirm(false); router.refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <section aria-label="برنامه‌ساز مربی" className="esi-card rounded-3xl p-4 sm:p-6">
    <h2 className="text-lg font-bold">برنامه‌ساز مربی</h2>
    <p className="mt-2 text-sm leading-6 text-esi-text-secondary">از یک الگو یا برنامه فعلی شروع کن؛ روزها، حرکت‌ها و فشار تمرین را برای همین ورزشکار تنظیم کن.</p>
    <fieldset disabled={busy} className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="text-xs font-semibold">الگوی شروع<select aria-label="الگوی شروع" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm" value={preset} onChange={e=>setPreset(e.target.value as PlanTemplateKey)}>{Object.entries(PLAN_TEMPLATE_LABELS).map(([key,label])=><option key={key} value={key}>{label} · {PLAN_PRESETS[key as PlanTemplateKey].level}</option>)}</select></label>
        <Button variant="secondary" className="self-end min-h-11" onClick={()=>{setDraft(fromPreset(preset));setSourceId(activePlan?.id ?? null);setSaved("");}}>بارگذاری الگو</Button>
      </div>
      {activePlan && <Button variant="ghost" size="sm" onClick={()=>{setDraft(copyActive(activePlan));setSourceId(activePlan.id);}}>کپی دوباره از برنامه فعلی</Button>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">نام برنامه<Input className="mt-2" value={draft.name} maxLength={100} onChange={e=>setDraft(p=>({...p,name:e.target.value}))}/></label>
        <label className="text-xs font-semibold">طول دوره (هفته)<Input type="number" className="mt-2" min={1} max={8} value={draft.weeks} onChange={e=>setDraft(p=>({...p,weeks:Number(e.target.value)}))}/></label>
        <label className="text-xs font-semibold">هدف<select className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm" value={draft.goalType} onChange={e=>setDraft(p=>({...p,goalType:e.target.value as CoachProgramDraft["goalType"]}))}>{Object.entries(GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold">جست‌وجوی حرکت<Input className="mt-2" placeholder="نام حرکت برای انتخاب در روزها" value={query} onChange={e=>setQuery(e.target.value)} /></label>
      </div>
      <label className="block text-xs font-semibold">توضیحات برای ورزشکار<Textarea className="mt-2" value={draft.description} maxLength={1000} onChange={e=>setDraft(p=>({...p,description:e.target.value}))}/></label>
      <p className="text-xs leading-6 text-esi-text-secondary">هر چرخه ۷ روز دارد؛ روز ۱ از امروز شروع می‌شود. نسخهٔ ثبت‌شده در همهٔ هفته‌ها یکسان است؛ افزایش خودکار فشار اعمال نمی‌شود. برای حرکات زمان‌دار، مدت هر ست را در یادداشت بنویس.</p>
      {draft.days.map((day,index)=><details key={index} className="rounded-2xl border border-border p-3 sm:p-4" open={index===0 || undefined}>
        <summary className="min-h-11 cursor-pointer text-sm font-bold">روز {toPersianDigits(index+1)} · {day.name} <span className="font-normal text-esi-text-muted">{day.isRest ? "استراحت" : `${toPersianDigits(day.exercises.length)} حرکت`}</span></summary>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex-1 text-xs">نام روز<Input value={day.name} maxLength={80} onChange={e=>patchDay(index,{name:e.target.value})}/></label>
          <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(day.isRest)} onChange={e=>patchDay(index,{isRest:e.target.checked,exercises:e.target.checked?[]:[{slug:available[0]?.slug ?? "",sets:2,repsMin:8,repsMax:12,rpe:7,rest:90}]})}/>روز استراحت</label>
        </div>
        {!day.isRest && <div className="mt-4 space-y-3">{day.exercises.map((exercise,position)=>{
          const options=available.filter(x=>x.slug===exercise.slug || normalizePersianSearch(x.nameFa).includes(normalizePersianSearch(query)));
          const patch=(change:Partial<typeof exercise>)=>patchDay(index,{exercises:day.exercises.map((e,i)=>i===position?{...e,...change}:e)});
          return <div key={position} className="rounded-xl bg-surface-2 p-3">
            <label className="block text-xs font-semibold">حرکت {toPersianDigits(position+1)}<select aria-label={`حرکت ${index+1}-${position+1}`} value={exercise.slug} onChange={e=>patch({slug:e.target.value})} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface-1 px-2 text-sm">
              {!available.some(x=>x.slug===exercise.slug) && <option value={exercise.slug}>نیازمند جایگزینی: {catalog.find(x=>x.slug===exercise.slug)?.nameFa ?? exercise.slug}</option>}
              {options.map(x=><option key={x.id} value={x.slug}>{x.nameFa} · {EQUIPMENT_LABEL_FA[x.equipment as EquipmentKey] ?? x.equipment}</option>)}
            </select></label>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{([['sets','ست',1,6,1],['repsMin','تکرار از',1,30,1],['repsMax','تکرار تا',1,30,1],['rpe','فشار RPE',5,9.5,0.5],['rest','استراحت (ثانیه)',0,300,15]] as const).map(([key,label,min,max,step])=><label key={key} className="text-[11px]">{label}<Input type="number" min={min} max={max} step={step} value={exercise[key]} onChange={e=>patch({[key]:Number(e.target.value)})}/></label>)}</div>
            <label className="mt-3 block text-xs">یادداشت حرکت<Input maxLength={300} value={exercise.note ?? ""} onChange={e=>patch({note:e.target.value})}/></label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" disabled={position===0} onClick={()=>{const list=[...day.exercises];[list[position-1],list[position]]=[list[position],list[position-1]];patchDay(index,{exercises:list});}}>بالاتر</Button>
              <Button size="sm" variant="ghost" disabled={position===day.exercises.length-1} onClick={()=>{const list=[...day.exercises];[list[position+1],list[position]]=[list[position],list[position+1]];patchDay(index,{exercises:list});}}>پایین‌تر</Button>
              <Button size="sm" variant="ghost" onClick={()=>patchDay(index,{exercises:day.exercises.filter((_,i)=>i!==position)})}>حذف حرکت</Button>
            </div>
          </div>;
        })}
          <Button variant="secondary" size="sm" disabled={day.exercises.length>=12 || !available.length} onClick={()=>patchDay(index,{exercises:[...day.exercises,{slug:available.find(x=>!day.exercises.some(e=>e.slug===x.slug))?.slug ?? available[0].slug,sets:2,repsMin:8,repsMax:12,rpe:7,rest:90}]})}>افزودن حرکت</Button>
        </div>}
      </details>)}
    </fieldset>
    {unavailable.length>0 && <p role="alert" className="mt-4 text-sm text-destructive">{toPersianDigits(unavailable.length)} حرکت با وسایل ثبت‌شده سازگار نیست یا هنوز در کتابخانه نیست؛ آن‌ها را جایگزین کن.</p>}
    {!validation.success && <p role="alert" className="mt-4 text-sm text-destructive">{issueMessage}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {saved && <p role="status" className="mt-4 text-sm text-primary">{saved}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-esi-text-secondary">{toPersianDigits(dayCount)} جلسه در هر ۷ روز · {toPersianDigits(draft.weeks)} هفته</p><Button disabled={busy || !validation.success || unavailable.length>0} onClick={()=>setConfirm(true)}>بازبینی و فعال‌سازی</Button></div>
    <AlertDialog open={confirm} onOpenChange={value=>{if(!busy)setConfirm(value);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>فعال‌سازی «{draft.name}»؟</AlertDialogTitle><AlertDialogDescription>این برنامه با {toPersianDigits(dayCount)} جلسه در هر هفت روز، از امروز جایگزین برنامهٔ فعلی می‌شود. برنامهٔ قبلی آرشیو می‌شود و تاریخچهٔ تمرین‌ها باقی می‌ماند.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>بازگشت به ویرایش</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void save();}}>{busy ? "در حال ثبت…" : "فعال‌سازی برنامه"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
