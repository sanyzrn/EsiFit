/**
 * Calculator registry — versioned (calculator_type + calculator_version).
 * Pure functions from lib/domain are the single computational source.
 */

export type CalculatorField = {
  key: string;
  label: string;
  unit?: string;
  type: "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: number | string;
};

export type CalculatorConfig = {
  slug: string;
  title: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  emoji: string;
  inputs: CalculatorField[];
  disclaimer: string;
  methodNote: string;
};

export const CALCULATOR_CONFIGS: CalculatorConfig[] = [
  {
    slug: "bmi",
    title: "شاخص توده بدنی (BMI)",
    tagline: "وزن شما نسبت به قد در کدام محدوده استاندارد است؟",
    metaTitle: "محاسبه BMI | ماشین‌حساب توده بدنی",
    metaDescription: "شاخص توده بدنی خود را با استاندارد WHO محاسبه کنید — نتیجه فوری و رایگان.",
    emoji: "⚖️",
    inputs: [
      { key: "weightKg", label: "وزن", unit: "کیلوگرم", type: "number", min: 30, max: 300, step: 0.5, placeholder: "۸۲" },
      { key: "heightCm", label: "قد", unit: "سانتی‌متر", type: "number", min: 100, max: 230, step: 1, placeholder: "۱۷۸" },
    ],
    disclaimer: "BMI ابزاری غربالگری است و ترکیب بدن (عضله در برابر چربی) را لحاظ نمی‌کند؛ برای ورزشکاران قدرتی تفسیر باید محتاطانه باشد.",
    methodNote: "فرمول: وزن (کیلوگرم) ÷ مجذور قد (متر). دسته‌بندی بر اساس استاندارد WHO.",
  },
  {
    slug: "tdee",
    title: "کالری روزانه (TDEE)",
    tagline: "بدن شما در روز چند کیلوکالری می‌سوزاند؟",
    metaTitle: "محاسبه TDEE و متابولیسم پایه",
    metaDescription: "مصرف انرژی روزانه خود را با فرمول میفلین-سن‌جور و ضرایب فعالیت استاندارد محاسبه کنید.",
    emoji: "🔥",
    inputs: [
      { key: "sex", label: "جنسیت", type: "select", options: [
        { value: "male", label: "مرد" },
        { value: "female", label: "زن" },
        { value: "undisclosed", label: "ترجیح می‌دهم نگویم" },
      ], defaultValue: "male" },
      { key: "birthYear", label: "سال تولد (شمسی)", type: "number", min: 1320, max: 1420, step: 1, placeholder: "۱۳۷۴" },
      { key: "weightKg", label: "وزن", unit: "کیلوگرم", type: "number", min: 30, max: 300, step: 0.5, placeholder: "۸۲" },
      { key: "heightCm", label: "قد", unit: "سانتی‌متر", type: "number", min: 100, max: 230, step: 1, placeholder: "۱۷۸" },
      { key: "activityLevel", label: "سطح فعالیت", type: "select", options: [
        { value: "sedentary", label: "کم‌تحرک (کار پشت میز)" },
        { value: "light", label: "سبک (۱–۳ روز تمرین)" },
        { value: "moderate", label: "متوسط (۳–۵ روز تمرین)" },
        { value: "active", label: "زیاد (۶–۷ روز تمرین)" },
        { value: "very_active", label: "بسیار زیاد (حرفه‌ای)" },
      ], defaultValue: "moderate" },
    ],
    disclaimer: "TDEE تخمین آماری است؛ بهتر است دو هفته وزن بدن را رصد و عدد را کالیبره کنید.",
    methodNote: "BMR با فرمول میفلین-سن‌جور (1990) × ضریب فعالیت استاندارد (۱٫۲ تا ۱٫۹).",
  },
  {
    slug: "macros",
    title: "پروتئین و ماکرو",
    tagline: "کالری و درصدهای پروتئین/کربوهیدرات/چربی بر اساس هدف شما",
    metaTitle: "محاسبه ماکرو و پروتئین روزانه",
    metaDescription: "تقسیم علمی ماکروها بر اساس هدف (حجم، کاهش وزن، ریکامپ) با پروتئین ۱٫۶ تا ۲٫۲ گرم بر کیلوگرم.",
    emoji: "🥗",
    inputs: [
      { key: "sex", label: "جنسیت", type: "select", options: [
        { value: "male", label: "مرد" },
        { value: "female", label: "زن" },
        { value: "undisclosed", label: "ترجیح می‌دهم نگویم" },
      ], defaultValue: "male" },
      { key: "birthYear", label: "سال تولد (شمسی)", type: "number", min: 1320, max: 1420, step: 1, placeholder: "۱۳۷۴" },
      { key: "weightKg", label: "وزن", unit: "کیلوگرم", type: "number", min: 30, max: 300, step: 0.5, placeholder: "۸۲" },
      { key: "heightCm", label: "قد", unit: "سانتی‌متر", type: "number", min: 100, max: 230, step: 1, placeholder: "۱۷۸" },
      { key: "activityLevel", label: "سطح فعالیت", type: "select", options: [
        { value: "sedentary", label: "کم‌تحرک" },
        { value: "light", label: "سبک" },
        { value: "moderate", label: "متوسط" },
        { value: "active", label: "زیاد" },
        { value: "very_active", label: "بسیار زیاد" },
      ], defaultValue: "moderate" },
      { key: "goal", label: "هدف", type: "select", options: [
        { value: "lose_weight", label: "کاهش وزن" },
        { value: "build_muscle", label: "عضله‌سازی" },
        { value: "recomp", label: "ریکامپ" },
        { value: "endurance", label: "استقامت" },
        { value: "health", label: "سلامت عمومی" },
      ], defaultValue: "build_muscle" },
    ],
    disclaimer: "در دیابت، بارداری، بیماری کلیوی یا اختلال خوردن، تقسیم ماکرو باید توسط متخصص تغذیه انجام شود.",
    methodNote: "پروتئین ۱٫۶–۲٫۲ گرم/کیلوگرم (بسته به هدف)، چربی حداقل ۲۵٪ انرژی، مابقی کربوهیدرات.",
  },
  {
    slug: "one-rep-max",
    title: "یک تکرار بیشینه (1RM)",
    tagline: "بدون تست خطرناک، از ست ۵ تکراری تا 1RM تخمین بزنید",
    metaTitle: "محاسبه ۱RM | فرمول اپلی و بژیتکی",
    metaDescription: "یک تکرار بیشینه را با فرمول‌های اپلی و بژیتکی امن محاسبه کنید و جدول تمرین درصدی بگیرید.",
    emoji: "🏋️",
    inputs: [
      { key: "weightKg", label: "وزنه", unit: "کیلوگرم", type: "number", min: 1, max: 500, step: 2.5, placeholder: "۶۰" },
      { key: "reps", label: "تعداد تکرار", type: "number", min: 1, max: 15, step: 1, placeholder: "۵" },
    ],
    disclaimer: "تخمین ۱RM جایگزین تکنیک صحیح نیست؛ حتماً حامل یا ایمنی دستگاه داشته باشید.",
    methodNote: "اپلی: وزن × (۱ + تکرار/۳۰). بژیتکی: وزن × ۳۶/(۳۷ − تکرار). میانگین دو فرمول در بازه ۲–۱۰ تکرار.",
  },
  {
    slug: "ideal-weight",
    title: "وزن ایده‌آل",
    tagline: "بازه وزنی پیشنهادی بر اساس قد و جنسیت",
    metaTitle: "محاسبه وزن ایده‌آل",
    metaDescription: "بازه وزن ایده‌آل با فرمول‌های دیواین و رابینسون — به همراه بازه سالم BMI.",
    emoji: "🎯",
    inputs: [
      { key: "sex", label: "جنسیت", type: "select", options: [
        { value: "male", label: "مرد" },
        { value: "female", label: "زن" },
        { value: "undisclosed", label: "ترجیح می‌دهم نگویم" },
      ], defaultValue: "male" },
      { key: "heightCm", label: "قد", unit: "سانتی‌متر", type: "number", min: 100, max: 230, step: 1, placeholder: "۱۷۸" },
    ],
    disclaimer: "«وزن ایده‌آل» یک بازه آماری است، نه هدف قطعی؛ ترکیب بدن و سلامت متابولیک مهم‌تر از عدد روی ترازو است.",
    methodNote: "دیواین (1974) و رابینسون با تطبیق اینچ بر فراتر از ۱۵۲٫۴ سانتی‌متر.",
  },
  {
    slug: "whtr",
    title: "نسبت دور کمر به قد",
    tagline: "شاخصی که چربی شکمی را بهتر از BMI نشان می‌دهد",
    metaTitle: "محاسبه نسبت کمر به قد (WHtR)",
    metaDescription: "نسبت دور کمر به قد را محاسبه کنید — شاخص قوی‌تر برای ارزیابی ریسک متابولیک.",
    emoji: "📏",
    inputs: [
      { key: "waistCm", label: "دور کمر", unit: "سانتی‌متر", type: "number", min: 40, max: 200, step: 0.5, placeholder: "۸۸", hint: "وسط ناف، پس از بازدم طبیعی" },
      { key: "heightCm", label: "قد", unit: "سانتی‌متر", type: "number", min: 100, max: 230, step: 1, placeholder: "۱۷۸" },
    ],
    disclaimer: "این شاخص غربالگری عمومی است و تشخیص پزشکی نیست.",
    methodNote: "دور کمر ÷ قد. محدوده سالم ۰٫۴ تا ۰٫۴۹ (پژوهش‌های اشول و همکاران).",
  },
  {
    slug: "water",
    title: "آب روزانه",
    tagline: "چقدر آب باید بنوشید؟ بر اساس وزن و تمرین",
    metaTitle: "محاسبه آب روزانه",
    metaDescription: "نیاز آبرسانی روزانه بر اساس وزن بدن و دقایق تمرین — راهنمای عملی هیدراتاسیون.",
    emoji: "💧",
    inputs: [
      { key: "weightKg", label: "وزن", unit: "کیلوگرم", type: "number", min: 30, max: 300, step: 1, placeholder: "۸۲" },
      { key: "trainingMinutes", label: "دقایق تمرین در روز", type: "number", min: 0, max: 300, step: 15, placeholder: "۶۰" },
    ],
    disclaimer: "در گرما، بیماری، بارداری یا شیردهی نیاز بیشتر می‌شود؛ تشنگی بهترین سیگنال واقعی است.",
    methodNote: "۳۳ میلی‌لیتر به ازای هر کیلوگرم + ۴۲۰ میلی‌لیتر به ازای هر ساعت تمرین.",
  },
  {
    slug: "body-fat-navy",
    title: "درصد چربی بدن",
    tagline: "روش دورهای بدن (ازماینده نیروی دریایی آمریکا)",
    metaTitle: "محاسبه درصد چربی بدن",
    metaDescription: "درصد چربی بدن با روش دورهای استاندارد نیروی دریایی آمریکا — با متر و بدون دستگاه.",
    emoji: "📊",
    inputs: [
      { key: "sex", label: "جنسیت", type: "select", options: [
        { value: "male", label: "مرد" },
        { value: "female", label: "زن" },
      ], defaultValue: "male" },
      { key: "heightCm", label: "قد", unit: "سانتی‌متر", type: "number", min: 100, max: 230, step: 1, placeholder: "۱۷۸" },
      { key: "neckCm", label: "دور گردن", unit: "سانتی‌متر", type: "number", min: 20, max: 60, step: 0.5, placeholder: "۳۸" },
      { key: "waistCm", label: "دور کمر", unit: "سانتی‌متر", type: "number", min: 40, max: 200, step: 0.5, placeholder: "۸۸", hint: "زنان: دور باسن به‌جای کمر" },
      { key: "hipCm", label: "دور باسن (فقط زنان)", unit: "سانتی‌متر", type: "number", min: 0, max: 200, step: 0.5, placeholder: "۰" },
    ],
    disclaimer: "روش دورها خطای ±۳–۴٪ دارد؛ برای روند پیشرفت خوب است، نه عدد دقیق آزمایشگاهی.",
    methodNote: "فرمول استاندارد U.S. Navy: مردان ۴۹۵/(۱٫۰۳۲−۰٫۱۹۰۷×log(کمر−گردن)+۰٫۱۵۴۸×log(قد))−۴۵۰؛ زنان با باسن.",
  },
];
