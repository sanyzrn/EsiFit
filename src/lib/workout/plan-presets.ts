import { PLAN_TEMPLATE_LABELS } from "./plan-titles";
export type PlanTemplateKey = keyof typeof PLAN_TEMPLATE_LABELS;
export type PlannedSpec = {
  slug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rpe: number;
  rest: number;
  note?: string;
};

export type DaySpec = {
  name: string;
  focusRegion: string;
  isRest?: boolean;
  exercises: PlannedSpec[];
};

const PPL_TEMPLATE: DaySpec[] = [
  {
    name: "پُش و سینه — قدرت",
    focusRegion: "chest_back",
    exercises: [
      { slug: "barbell-bench-press", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "barbell-row", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "incline-dumbbell-press", sets: 3, repsMin: 8, repsMax: 12, rpe: 7.5, rest: 120 },
      { slug: "lat-pulldown", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "lateral-raise", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "triceps-pushdown", sets: 3, repsMin: 10, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
  {
    name: "پا — پایه",
    focusRegion: "legs",
    exercises: [
      { slug: "barbell-squat", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 180 },
      { slug: "romanian-deadlift", sets: 3, repsMin: 8, repsMax: 10, rpe: 7.5, rest: 150 },
      { slug: "leg-press", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 120 },
      { slug: "leg-curl", sets: 3, repsMin: 10, repsMax: 15, rpe: 8, rest: 90 },
      { slug: "calf-raise", sets: 4, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "plank", sets: 3, repsMin: 1, repsMax: 1, rpe: 7, rest: 60, note: "هر ست ۴۵ ثانیه" },
    ],
  },
  {
    name: "استراحت فعال",
    focusRegion: "recovery",
    isRest: true,
    exercises: [
      { slug: "treadmill-run", sets: 1, repsMin: 1, repsMax: 1, rpe: 5, rest: 0, note: "۲۰ تا ۳۰ دقیقه پیاده‌روی تند یا دویدن سبک" },
    ],
  },
  {
    name: "سرشانه و بازو — حجم",
    focusRegion: "shoulders_arms",
    exercises: [
      { slug: "overhead-press", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "seated-cable-row", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "dumbbell-shoulder-press", sets: 3, repsMin: 8, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "biceps-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "hammer-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "face-pull", sets: 3, repsMin: 15, repsMax: 20, rpe: 7, rest: 60 },
    ],
  },
];

const rest = (): DaySpec => ({ name: "استراحت", focusRegion: "recovery", isRest: true, exercises: [] });
const UPPER_LOWER_TEMPLATE: DaySpec[] = [
  {
    name: "بالاتنه — قدرت",
    focusRegion: "chest_back",
    exercises: [
      { slug: "barbell-bench-press", sets: 4, repsMin: 5, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "barbell-row", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "overhead-press", sets: 3, repsMin: 8, repsMax: 10, rpe: 7.5, rest: 120 },
      { slug: "lat-pulldown", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "biceps-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "triceps-pushdown", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
    ],
  },
  {
    name: "پایین‌تنه — قدرت",
    focusRegion: "legs",
    exercises: [
      { slug: "barbell-squat", sets: 4, repsMin: 5, repsMax: 8, rpe: 8, rest: 180 },
      { slug: "leg-press", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 120 },
      { slug: "romanian-deadlift", sets: 3, repsMin: 8, repsMax: 10, rpe: 7.5, rest: 150 },
      { slug: "leg-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 90 },
      { slug: "calf-raise", sets: 4, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
  {
    name: "استراحت فعال",
    focusRegion: "recovery",
    isRest: true,
    exercises: [
      { slug: "treadmill-run", sets: 1, repsMin: 1, repsMax: 1, rpe: 5, rest: 0, note: "۲۰ دقیقه پیاده‌روی تند" },
    ],
  },
  {
    name: "بالاتنه — حجم",
    focusRegion: "chest_back",
    exercises: [
      { slug: "incline-dumbbell-press", sets: 4, repsMin: 8, repsMax: 12, rpe: 8, rest: 105 },
      { slug: "seated-cable-row", sets: 4, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "dumbbell-shoulder-press", sets: 3, repsMin: 8, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "face-pull", sets: 3, repsMin: 15, repsMax: 20, rpe: 7, rest: 60 },
      { slug: "hammer-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "lateral-raise", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
  {
    name: "پایین‌تنه — حجم",
    focusRegion: "legs",
    exercises: [
      { slug: "leg-press", sets: 4, repsMin: 10, repsMax: 12, rpe: 8, rest: 120 },
      { slug: "hip-thrust", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 105 },
      { slug: "leg-extension", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 75 },
      { slug: "leg-curl", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 75 },
      { slug: "calf-raise", sets: 4, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "plank", sets: 3, repsMin: 1, repsMax: 1, rpe: 7, rest: 60, note: "هر ست ۴۵ ثانیه" },
    ],
  },
  {
    name: "استراحت",
    focusRegion: "recovery",
    isRest: true,
    exercises: [],
  },
  {
    name: "بالاتنه — تکراربازی",
    focusRegion: "chest_back",
    exercises: [
      { slug: "push-up", sets: 4, repsMin: 12, repsMax: 20, rpe: 8, rest: 75 },
      { slug: "dumbbell-row", sets: 4, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 90 },
      { slug: "pull-up", sets: 3, repsMin: 5, repsMax: 10, rpe: 8, rest: 120 },
      { slug: "lateral-raise", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "biceps-curl", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
];

const spec = (slug: string, sets = 3, repsMin = 8, repsMax = 12, note?: string): PlannedSpec => ({ slug, sets, repsMin, repsMax, rpe: 7, rest: 90, note });
const day = (name: string, exercises: PlannedSpec[], focusRegion = "full_body"): DaySpec => ({ name, focusRegion, exercises });
const fullA = day("تمام‌بدن A", [spec("goblet-squat"), spec("dumbbell-bench-press"), spec("seated-cable-row"), spec("romanian-deadlift",2), spec("plank",2,1,1,"هر ست ۳۰ تا ۴۵ ثانیه")]);
const fullB = day("تمام‌بدن B", [spec("leg-press"), spec("lat-pulldown"), spec("dumbbell-shoulder-press",2), spec("hip-thrust",2), spec("dead-bug",2,8,12)]);
const homeA = day("خانه A", [spec("bodyweight-squat",2,10,15),spec("incline-push-up",2,8,12),spec("glute-bridge",2,12,15),spec("bird-dog",2,8,12),spec("reverse-plank",2,1,1,"هر ست ۲۰ تا ۳۰ ثانیه")]);
const homeB = day("خانه B", [spec("reverse-lunge",2,8,12),spec("push-up",2,6,12),spec("superman",2,8,12),spec("dead-bug",2,8,12),spec("side-plank",2,1,1,"هر سمت ۲۰ تا ۳۰ ثانیه")]);
const dbA = day("دمبل A", [spec("dumbbell-squat"),spec("dumbbell-bench-press"),spec("dumbbell-row"),spec("dumbbell-romanian-deadlift"),spec("dead-bug",2)]);
const dbB = day("دمبل B", [spec("lunge"),spec("dumbbell-shoulder-press"),spec("dumbbell-row"),spec("dumbbell-curl",2),spec("dumbbell-calf-raise",2,12,20)]);
export type PlanPreset = { name: string; description: string; level: string; days: DaySpec[] };
export const PLAN_PRESETS: Record<PlanTemplateKey, PlanPreset> = {
 ppl: { name: "برنامه سه‌روزه اسی‌فیت", description: "سه جلسه تفکیکی در هفته؛ روزهای ریکاوری جدا هستند.", level: "متوسط", days: [PPL_TEMPLATE[0],rest(),PPL_TEMPLATE[1],rest(),PPL_TEMPLATE[3],rest(),rest()] },
 upper_lower: { name: "بالاتنه و پایین‌تنه — ۵ جلسه", description: "پنج جلسه برای ورزشکار باتجربه؛ با دو روز ریکاوری.", level: "باتجربه", days: UPPER_LOWER_TEMPLATE.map(d => d.isRest ? { ...d, exercises: [] } : d) },
 full_body_2: { name: "تمام‌بدن — ۲ جلسه", description: "شروع کم‌حجم با دو جلسه غیرمتوالی برای گروه‌های اصلی بدن.", level: "مبتدی", days:[fullA,rest(),rest(),fullB,rest(),rest(),rest()] },
 full_body_3: { name: "تمام‌بدن — ۳ جلسه", description: "سه جلسه غیرمتوالی با حرکات پایه؛ حجم با نظر مربی تنظیم شود.", level:"مبتدی تا متوسط", days:[fullA,rest(),fullB,rest(),fullA,rest(),rest()] },
 upper_lower_4: { name: "بالاتنه و پایین‌تنه — ۴ جلسه", description:"تقسیم متعادل بالاتنه و پایین‌تنه، با استراحت بین بلوک‌ها.",level:"متوسط",days:[UPPER_LOWER_TEMPLATE[0],UPPER_LOWER_TEMPLATE[1],rest(),UPPER_LOWER_TEMPLATE[3],UPPER_LOWER_TEMPLATE[4],rest(),rest()] },
 home_3: { name:"خانه، بدون وزنه — ۳ جلسه",description:"تمرین عمومی با وزن بدن و سطح ثابت؛ شدت و دامنه با توان فرد تنظیم شود.",level:"مبتدی",days:[homeA,rest(),homeB,rest(),homeA,rest(),rest()] },
 dumbbell_3: { name:"دمبل — ۳ جلسه",description:"سه جلسه تمام‌بدن با دمبل و نیمکت؛ مناسب تجهیزات محدود.",level:"مبتدی تا متوسط",days:[dbA,rest(),dbB,rest(),dbA,rest(),rest()] },
 ppl_6: { name:"پوش، پول، پا — ۶ جلسه",description:"حجم و دفعات بالا برای ورزشکار باتجربه؛ مربی باید ریکاوری و درد را بررسی کند.",level:"باتجربه",days:[day("پوش",[spec("barbell-bench-press"),spec("dumbbell-shoulder-press"),spec("lateral-raise",2,12,15),spec("triceps-pushdown",2)]),day("پول",[spec("lat-pulldown"),spec("barbell-row"),spec("face-pull",2,12,15),spec("dumbbell-curl",2)]),UPPER_LOWER_TEMPLATE[1],day("پوش",[spec("incline-dumbbell-press"),spec("dumbbell-shoulder-press"),spec("lateral-raise",2,12,15),spec("triceps-pushdown",2)]),day("پول",[spec("lat-pulldown"),spec("seated-cable-row"),spec("face-pull",2,12,15),spec("hammer-curl",2)]),UPPER_LOWER_TEMPLATE[4],rest()] },
};
