"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/ui/icon";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/client/api";
import { toPersianDigits as fa } from "@/lib/formatting/numbers";
import type { PlanningContext } from "@/lib/ai/planning/rules";
import type { PlanningRunView } from "@/lib/ai/planning/contract";

type State={actorId:string;athleteId:string;quota:{used:number;monthUsed:number;limit:number;monthlyLimit:number};enabled:boolean;aiAvailable:boolean;canApply:boolean;providerLabel:string|null;athleteConsent:boolean;context:PlanningContext;risks:string[];liveSession:boolean;run:PlanningRunView|null;movements:Array<{slug:string;nameFa:string}>};
const FAILURE:Record<string,string>={not_configured:'برنامه‌ریز هوشمند هنوز توسط مدیر فعال نشده است.',quota:'سهمیهٔ برنامه‌ریزی هوشمند تمام شده است؛ پیشنهاد پایه همچنان قابل بررسی است.',consent_required:'ورزشکار هنوز اجازهٔ استفاده از اطلاعاتش در برنامه‌ریز را ثبت نکرده است.',provider_or_validation:'اتصال به مدل یا کنترل کیفیت پاسخ موفق نبود؛ پیشنهاد پایه جایگزین شد.',interrupted:'درخواست قبلی کامل نشد؛ برنامهٔ قبلی حفظ شده است.'};
const GOALS:Record<string,string>={lose_weight:'کاهش وزن',build_muscle:'عضله‌سازی',health:'سلامت عمومی',recomp:'بازترکیب بدنی',endurance:'استقامت'};
export function TrainingPlanner({athleteId,staff=false}:{athleteId?:string;staff?:boolean}) {
  const router=useRouter();const [state,setState]=React.useState<State|null>(null);const [loading,setLoading]=React.useState(true);
  const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');const [reason,setReason]=React.useState('');
  const [consent,setConsent]=React.useState(false);const [confirm,setConfirm]=React.useState(false);const [online,setOnline]=React.useState(true);
  const inFlight=React.useRef(false);const pendingRequest=React.useRef<string|null>(null);
  const load=React.useCallback(async(quiet=false)=>{
    if(inFlight.current)return;inFlight.current=true;if(!quiet)setLoading(true);
    try{
      const query=new URLSearchParams(athleteId?{athleteId}:{});
      if(pendingRequest.current)query.set('requestId',pendingRequest.current);
      let result=await api<State>(`/api/ai/planning?${query}`);
      const key=`esifit:planning-request:${result.actorId}:${result.athleteId}`;
      if(!pendingRequest.current){try{pendingRequest.current=sessionStorage.getItem(key)}catch{}if(pendingRequest.current){query.set('requestId',pendingRequest.current);result=await api<State>(`/api/ai/planning?${query}`);}}
      if(pendingRequest.current&&result.run?.status!=='generating'){pendingRequest.current=null;try{sessionStorage.removeItem(key)}catch{}}
      setState(result);setError('');
    }
    catch(e){setError(errorMessage(e));}finally{inFlight.current=false;setLoading(false);}
  },[athleteId]);
  React.useEffect(()=>{void load();},[load]);
  React.useEffect(()=>{const update=()=>{setOnline(navigator.onLine);if(navigator.onLine)void load(true);};setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[load]);
  React.useEffect(()=>{if(state?.run?.status!=='generating'||!online)return;const timer=setInterval(()=>void load(true),5000);return()=>clearInterval(timer);},[state?.run?.status,online,load]);
  async function generate(mode:'ai'|'rules'){
    setBusy(true);setError('');const requestId=crypto.randomUUID();pendingRequest.current=requestId;if(state)try{sessionStorage.setItem(`esifit:planning-request:${state.actorId}:${state.athleteId}`,requestId)}catch{}try{const result=await api<{run:PlanningRunView}>('/api/ai/planning',{method:'POST',signal:AbortSignal.timeout(70000),json:{requestId,athleteId,reason,consent:true,mode}});setState(s=>s?{...s,run:result.run}:s);pendingRequest.current=null;if(state)try{sessionStorage.removeItem(`esifit:planning-request:${state.actorId}:${state.athleteId}`)}catch{}await load(true);}
    catch(e){setError(`${errorMessage(e)} اگر ارتباط قطع شد، پیش از ساخت درخواست تازه «بازیابی نتیجه» را بزن؛ ممکن است نتیجه در سرور آماده شده باشد.`);}
    finally{setBusy(false);}
  }
  async function act(action:'apply'|'human_review'|'cancel'|'revoke_consent'){
    if(!state?.run&&action!=='revoke_consent')return;setBusy(true);setError('');try{const result=await api<{run:PlanningRunView}>('/api/ai/planning',{method:'PATCH',json:{id:state?.run?.id,action}});if(action==='revoke_consent'){setConsent(false);await load(true);}else setState(s=>s?{...s,run:result.run}:s);if(action==='apply'){router.refresh();await load(true);}}
    catch(e){setError(errorMessage(e));}finally{setBusy(false);setConfirm(false);}
  }
  const run=state?.run;const working=busy||run?.status==='generating';
  const names=new Map(state?.movements.map(e=>[e.slug,e.nameFa])??[]);
  return <section id="training-planner" aria-label="برنامه‌ریز مستقل اسی‌فیت" className="esi-card rounded-3xl border border-primary/25 p-4 sm:p-6">
    <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name="Sparkles" size={22}/></span><div><p className="text-xs font-bold text-primary">برنامه‌ریز اسی‌فیت</p><h2 className="mt-1 text-xl font-bold">برنامه‌ای برای شرایطِ امروز {staff?'ورزشکار':'تو'}</h2><p className="mt-2 text-xs leading-6 text-esi-text-secondary">این بخش با گفت‌وگوی همپا جداست: پرونده ← پیش‌نویس ← بررسی و فعال‌سازی.</p></div></div>
    {loading?<p role="status" className="py-8 text-center text-sm text-esi-text-muted">در حال خواندن پرونده و آخرین درخواست…</p>:state&&<>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">{[GOALS[state.context.goal??'']??'هدف نامشخص',`${fa(state.context.days)} روز آزاد`,`${fa(state.context.minutes)} دقیقه در جلسه`,state.context.age!=null?`${fa(state.context.age)} سال`:'سن ثبت نشده'].map(t=><span key={t} className="rounded-full border border-border bg-surface-2 px-3 py-2">{t}</span>)}</div>
      {state.aiAvailable&&<p className="mt-3 text-xs text-esi-text-muted">سهمیهٔ مستقل این حساب: امروز {fa(state.quota.used)} از {fa(state.quota.limit)} · ماه جاری {fa(state.quota.monthUsed)} از {fa(state.quota.monthlyLimit)}</p>}
      {!staff&&<Link className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-primary" href="/auth/onboarding?next=/workouts">ویرایش شرایط، زمان و محدودیت‌ها</Link>}
      {!online&&<p role="status" className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm leading-7">اینترنت قطع است. برنامهٔ فعلی جایگزین نمی‌شود؛ پس از اتصال، نتیجهٔ همین درخواست را بازیابی کن. هیچ درخواست هوشی خودکار دوباره ارسال نمی‌شود.</p>}
      {state.risks.length>0&&<div className="mt-4 rounded-2xl border border-border bg-surface-2 p-4"><h3 className="text-sm font-bold">اول بررسی انسانی</h3><ul className="mt-2 space-y-2 text-xs leading-6 text-esi-text-secondary">{state.risks.map(r=><li key={r}>{r}</li>)}</ul><p className="mt-2 text-xs leading-6">این ابزار برای تشخیص یا درمان مصدومیت نیست؛ در درد شدید یا ناگهانی تمرین را متوقف و ارزیابی پزشکی را پیگیری کن.</p></div>}
      {!state.enabled&&<p role="status" className="mt-4 text-sm">برنامه‌ریز موقتاً غیرفعال است؛ برنامه و سوابق قبلی حفظ شده‌اند.</p>}
      {state.liveSession&&<p role="status" className="mt-4 text-sm text-primary">یک جلسه در حال انجام است؛ ابتدا آن را پایان بده تا برنامهٔ تازه بسازیم.</p>}
      {!state.aiAvailable&&<p className="mt-4 text-xs leading-6 text-esi-text-secondary">هوش برنامه‌ریز فعلاً فعال نیست. پیشنهاد پایه بدون ارسال اطلاعات به مدل ساخته می‌شود و با برچسب جدا مشخص است.</p>}
      <label className="mt-5 block text-xs font-semibold">چه چیزی نسبت به قبل عوض شده؟ <span className="font-normal text-esi-text-muted">(اختیاری)</span><Textarea className="mt-2" value={reason} disabled={working} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder="مثلاً زمانم کمتر شده، تمرین قبلی سخت بود یا هدفم عوض شده…"/></label>
      {state.aiAvailable&&state.risks.length===0&&!staff&&<label className="mt-4 flex min-h-11 items-start gap-3 text-xs leading-6"><input type="checkbox" className="mt-1" checked={consent} disabled={working} onChange={e=>setConsent(e.target.checked)}/><span>اجازه می‌دهم سن، جنسیت اعلام‌شده، قد، وزن، هدف، وسایل ، خلاصهٔ تمرین‌ها و توضیح همین درخواست برای ساخت این پیشنهاد به اتصال «{state.providerLabel}» که مدیر انتخاب کرده ارسال شود. نام و شمارهٔ حساب در دادهٔ پرونده فرستاده نمی‌شوند.</span></label>}
      {staff&&state.aiAvailable&&!state.athleteConsent&&<p className="mt-3 text-xs text-esi-text-secondary">برای ساخت با مدل، ورزشکار باید ابتدا اجازهٔ برنامه‌ریزی هوشمند را در حساب خودش ثبت کند؛ پیشنهاد پایه به این اجازه نیاز ندارد.</p>}
      {!staff&&state.athleteConsent&&<Button variant="ghost" size="sm" className="mt-2" disabled={working||!online} onClick={()=>void act("revoke_consent")}>لغو اجازهٔ استفاده از اطلاعات در برنامه‌ریز</Button>}
      <div className="mt-4 flex flex-wrap gap-2">
        {state.risks.length?<Button disabled={working||!online||!state.enabled||state.liveSession} onClick={()=>void generate('rules')}>بررسی پرونده برای مربی</Button>:<>
          <Button disabled={working||!online||!state.enabled||!state.aiAvailable||state.liveSession||(!staff&&!consent)||(staff&&!state.athleteConsent)} onClick={()=>void generate('ai')}><Icon name="Sparkles" size={16} className="me-2"/>{working?'در حال آماده‌سازی…':state.context.activePlan?'بازسازی هوشمند':'ساخت برنامه با هوش'}</Button>
          <Button variant="secondary" disabled={working||!online||!state.enabled||state.liveSession} onClick={()=>void generate('rules')}>پیشنهاد پایه بدون هوش</Button>
        </>}
        <Button variant="ghost" disabled={busy||!online} onClick={()=>void load()}>بازیابی نتیجه</Button>
      </div>
      {working&&<p role="status" className="mt-4 flex items-center gap-2 text-sm text-esi-text-secondary"><Icon name="LoaderCircle" size={16} className="animate-spin motion-reduce:animate-none"/>در حال تهیهٔ پیش‌نویس؛ تا پایان بررسی، برنامهٔ قبلی فعال می‌ماند.</p>}
      {run&&<div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold">{run.status==='applied'?'برنامهٔ تأییدشده':run.status==='needs_review'?'نیازمند بررسی مربی':'آخرین پیش‌نویس'}</h3><span className="rounded-full bg-surface-2 px-3 py-2 text-xs">{run.source==='ai'?'پیش‌نویس مدل':run.source==='human'?'ثبت مربی انسانی':!run.plan?'بررسی پرونده':'پیشنهاد مبتنی بر قواعد'}</span></div>
        {run.failureCode&&FAILURE[run.failureCode]&&<p className="mt-3 text-xs leading-6 text-esi-text-secondary">{FAILURE[run.failureCode]}</p>}
        {run.requestNote&&<p className="mt-3 text-xs leading-6">توضیح درخواست: {run.requestNote}</p>}
        <ul className="mt-3 space-y-2 text-xs leading-6 text-esi-text-secondary">{[...run.reasons,...run.risks].map((text,i)=><li key={i}>{text}</li>)}</ul>
        {run.plan&&<><h4 className="mt-5 font-bold">{run.plan.name}</h4><p className="mt-2 text-xs leading-6 text-esi-text-secondary">{run.plan.description}</p><p className="mt-2 text-xs">{fa(run.plan.weeks)} هفته · نسخهٔ هر هفته یکسان است؛ افزایش فشار خودکار ندارد.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{run.plan.days.map((day,i)=><details key={i} className="rounded-2xl border border-border bg-surface-2 p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">روز {fa(i+1)} · {day.name} {day.isRest?'· استراحت':`· ${fa(day.exercises.length)} حرکت`}</summary><ol className="mt-3 space-y-3">{day.exercises.map((e,j)=><li key={e.slug} className="rounded-xl bg-surface-1 p-3 text-xs"><p className="font-semibold">{fa(j+1)}. {names.get(e.slug)??e.slug}</p><p className="mt-2 leading-6 text-esi-text-secondary">{fa(e.sets)} ست · {e.repsMin===1&&e.repsMax===1?"زمان‌دار":`${fa(e.repsMin)}–${fa(e.repsMax)} تکرار`} · فشار {fa(e.rpe)} از ۱۰ · استراحت {fa(e.rest)} ثانیه</p>{e.note&&<p className="mt-1 leading-6">{e.note}</p>}</li>)}</ol></details>)}</div></>}
        {run.status==='ready'&&<div className="mt-5 flex flex-wrap gap-2">{state.canApply?<Button disabled={working||!online} onClick={()=>setConfirm(true)}>بررسی شد؛ فعال‌سازی برنامه</Button>:<p className="w-full text-xs leading-6 text-esi-text-secondary">مربی فعال داری؛ برای هماهنگی با برنامهٔ او، این پیش‌نویس باید توسط مربی تأیید شود.</p>}<Button variant="secondary" disabled={working||!online} onClick={()=>void act('human_review')}>اول مربی بررسی کند</Button><Button variant="ghost" disabled={working||!online} onClick={()=>void act('cancel')}>کنارگذاشتن پیش‌نویس</Button></div>}
        {run.status==='needs_review'&&!run.reviewRequestedAt&&<Button className="mt-4" disabled={working||!online} onClick={()=>void act('human_review')}>ثبت درخواست بررسی انسانی</Button>}
        {run.reviewRequestedAt&&<p role="status" className="mt-4 rounded-2xl bg-primary/10 p-4 text-sm leading-7">درخواست در سایت ثبت شد؛ اگر مربی فعال داری به او اعلان داده شد، در غیر این صورت مدیر برای تعیین مربی مطلع شده است. این اعلان داخل سایت است و به معنی پاسخ فوری نیست.{staff?' مربی می‌تواند از برنامه‌ساز این پرونده نسخهٔ بررسی‌شده را ثبت کند.':''}</p>}
        {run.status==='applied'&&<p role="status" className="mt-4 text-sm font-semibold text-primary">برنامه با تأیید فعال شد؛ سوابق تمرین و برنامهٔ قبلی حفظ شده‌اند.</p>}
        {run.status==='failed'&&<p className="mt-3 text-xs leading-6">این درخواست کامل نشد؛ ابتدا نتیجه را بازیابی کن. سپس در صورت نیاز یک درخواست تازه بساز.</p>}
        {run.status==='cancelled'&&<p className="mt-3 text-xs">این پیش‌نویس کنار گذاشته شد و برنامهٔ فعلی تغییر نکرد.</p>}
      </div>}
    </>}
    {error&&<p role="alert" className="mt-4 text-sm leading-7 text-destructive">{error}</p>}
    {!state&&!loading&&<Button variant="secondary" className="mt-4" onClick={()=>void load()}>تلاش دوباره</Button>}
    <AlertDialog open={confirm} onOpenChange={value=>{if(!busy)setConfirm(value)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>«{run?.plan?.name}» فعال شود؟</AlertDialogTitle><AlertDialogDescription>روز اول از امروز آغاز می‌شود. برنامهٔ قبلی آرشیو می‌شود؛ تمرین‌ها و رکوردهای قبلی باقی می‌مانند. این پیش‌نویس را از نظر حرکت‌ها، زمان، فشار و محدودیت‌ها بررسی کرده‌ام.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>بازگشت به بررسی</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void act('apply')}}>{busy?'در حال ثبت…':'تأیید و فعال‌سازی'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
