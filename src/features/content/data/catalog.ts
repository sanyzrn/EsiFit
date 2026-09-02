/**
 * Commerce + gamification + community seed catalogs.
 */

export const BADGES = [
  { slug: "first-workout", nameFa: "قدم اول", descriptionFa: "اولین تمرین ثبت‌شده در اسی‌فیت", icon: "flag", criteriaType: "workout_count", criteriaValue: 1, tier: "bronze" },
  { slug: "consistent-10", nameFa: "ده تایی", descriptionFa: "۱۰ تمرین کامل ثبت کردید", icon: "target", criteriaType: "workout_count", criteriaValue: 10, tier: "bronze" },
  { slug: "committed-25", nameFa: "مصمم", descriptionFa: "۲۵ تمرین کامل ثبت کردید", icon: "flame", criteriaType: "workout_count", criteriaValue: 25, tier: "silver" },
  { slug: "iron-veteran-50", nameFa: "کهنه‌کار آهن", descriptionFa: "۵۰ تمرین کامل ثبت کردید", icon: "medal", criteriaType: "workout_count", criteriaValue: 50, tier: "gold" },
  { slug: "first-pr", nameFa: "رکوردشکن", descriptionFa: "اولین رکورد شخصی ثبت شد", icon: "trophy", criteriaType: "pr_count", criteriaValue: 1, tier: "bronze" },
  { slug: "pr-hunter-5", nameFa: "شکارچی رکورد", descriptionFa: "۵ رکورد شخصی جدید", icon: "zap", criteriaType: "pr_count", criteriaValue: 5, tier: "silver" },
  { slug: "streak-14", nameFa: "دو هفته آتشین", descriptionFa: "۱۴ روز فعالیت پیوسته", icon: "calendar-check", criteriaType: "streak", criteriaValue: 14, tier: "silver" },
  { slug: "volume-10t", nameFa: "۱۰ تُن باشگاه", descriptionFa: "مجموع ۱۰٬۰۰۰ کیلوگرم حجم تمرینی", icon: "mountain", criteriaType: "volume", criteriaValue: 10000, tier: "silver" },
  { slug: "volume-50t", nameFa: "۵۰ تُن باشگاه", descriptionFa: "مجموع ۵۰٬۰۰۰ کیلوگرم حجم تمرینی", icon: "rocket", criteriaType: "volume", criteriaValue: 50000, tier: "gold" },
  { slug: "hydration-hero", nameFa: "قهرمان آب", descriptionFa: "۷ روز پیوسته به هدف آب رسیدید", icon: "droplets", criteriaType: "water_days", criteriaValue: 7, tier: "bronze" },
  { slug: "nutrition-week", nameFa: "تغذیه منظم", descriptionFa: "۷ روز پیوسته ثبت تغذیه", icon: "apple", criteriaType: "nutrition_days", criteriaValue: 7, tier: "bronze" },
  { slug: "early-bird", nameFa: "سحرخیز", descriptionFa: "تمرین قبل از ساعت ۸ صبح", icon: "sunrise", criteriaType: "early", criteriaValue: 1, tier: "bronze" },
];

export const MISSIONS = [
  { slug: "daily-workout", nameFa: "امروز را تمرین کن", descriptionFa: "یک جلسه تمرین کامل ثبت کنید", period: "daily", criteriaType: "workout", target: 1, xpReward: 60, active: true },
  { slug: "daily-water", nameFa: "آب کافی بنوش", descriptionFa: "به هدف آب روزانه برسید", period: "daily", criteriaType: "water_ml", target: 2500, xpReward: 25, active: true },
  { slug: "daily-sets", nameFa: "دوازده ست", descriptionFa: "۱۲ ست تمرینی در یک روز ثبت کنید", period: "daily", criteriaType: "sets_logged", target: 12, xpReward: 40, active: true },
  { slug: "weekly-protein", nameFa: "پروتئین دقیق", descriptionFa: "۵ روز در هفته به هدف پروتئین برسید", period: "weekly", criteriaType: "protein_hit", target: 5, xpReward: 100, active: true },
];

export const CHALLENGES = [
  { slug: "mordad-volume-battle", nameFa: "نبرد حجم شهریور", description: "بیشترین حجم تمرینی ثبت‌شده در ۳۰ روز؛ هر ست حساب می‌شود.", metric: "volume", targetValue: 50000, status: "active", isPrivate: false, emoji: "🏔️", badgeSlug: "volume-10t" },
  { slug: "water-warriors", nameFa: "سربازان آب", description: "۲۱ روز پیوسته به هدف آب روزانه برسید.", metric: "water", targetValue: 21, status: "active", isPrivate: false, emoji: "💧", badgeSlug: "hydration-hero" },
  { slug: "consistency-club", nameFa: "باشگاه پیوستگی", description: "۱۶ تمرین در ۳۰ روز — چهار تمرین در هفته.", metric: "workouts", targetValue: 16, status: "active", isPrivate: false, emoji: "🎯", badgeSlug: "committed-25" },
];

export const COMMUNITY_POSTS = Array.from(
  [
    { content: "بالاخره بعد از ۶ ماه اسکات زیر موازی زمین اومد 🎉 ثبات مهم‌تر از شدت بود، واقعاً.", workoutType: "legs", hoursAgo: 2, comments: ["دمت گرم! من هنوز روی عمقش کار دارم", "انگیزه گرفتم برای امشب"] },
    { content: "نکته‌ای که برام جواب داد: بعد از پرس سینه سنگین، دو ست فیس‌پول برای سلامت شانه. دیگه درد سرشانه ندارم.", workoutType: "chest", hoursAgo: 5, comments: ["این توصیه فیزیوتراپیست من هم بود", "دقیقاً! پیشگیری بهتر از درمانه"] },
    { content: "۳۰ روز پیوسته حلقه آب کامل شد 💧 کوچک به نظر میاد ولی رکورد شخصی خودمه.", hoursAgo: 9, comments: ["ایول! پیوستگی همه‌چیزه"] },
    { content: "کسی ترکیب بهتری برای روز پا سراغ داره غیر از اسکات + ددلیفت رومانیایی؟ خواب پام خیلی خوابیده بود دیروز 😅", workoutType: "legs", hoursAgo: 26, comments: ["حجم کم کن یه هفته ببین", "شب قبل روز پا کربوهیدرات بیشتر بخور"] },
    { content: "گزارش هفتگی اسی‌فیت امروز اومد: ۴ تمرین، ۹٬۲۰۰ کیلوگرم حجم، امتیاز آمادگی میانگین ۷۸. بهترین هفته امسال تا الان.", hoursAgo: 31, comments: ["عددها حرف می‌زنن", "گزارش هفتگی واقعاً مفیده"] },
    { content: "رکورد جدید ددلیفت: ۱۴۰ کیلو! با کمردرد قبلی هم مدیریت شد چون ثبت روزانه نشون داد کی باید سبک‌تر بزنم.", workoutType: "back", hoursAgo: 47, comments: ["۱۴۰ قوی 💪", "پیشرفت امن، عالیه"] },
  ].map((p, i) => ({ ...p, id: `post-${i + 1}` }))
);

export const PRODUCTS = [
  { slug: "esifit-shaker-700", nameFa: "شیکر اسی‌فیت ۷۰۰ میلی‌لیتری", description: "بدنه فومی ضدتعریق، مخفیک مارپیچ فولادی، درزگیری کامل. لوگوی حکاکی‌شده اسی‌فیت.", type: "physical", priceToman: 389000, compareAtToman: 490000, emoji: "🧴", status: "active", stock: 120, badge: "پرفروش" },
  { slug: "lifting-belts", nameFa: "کمربند پاورلیفتینگ چرم طبیعی", description: "۱۰ میلی‌متر ضخامت، ۱۰ سانتی‌متر عرض، آپولو چرم گاوی با قفل دوبل.", type: "physical", priceToman: 2450000, compareAtToman: null, emoji: "🎽", status: "active", stock: 25, badge: "" },
  { slug: "resistance-band-set", nameFa: "ست کش مقاومتی ۵ سطحی", description: "لاتکس لایه‌ای با پوشش نخی؛ برای گرم کردن، کشش و تمرین خانه.", type: "physical", priceToman: 690000, compareAtToman: 850000, emoji: "🎗️", status: "active", stock: 80, badge: "پیشنهاد ویژه" },
  { slug: "protein-whey-2kg", nameFa: "پروتئین وی کنسانتره ۲ کیلوگرمی", description: "۲۴ گرم پروتئین در هر اسکوپ، طعم شکلاتی؛ آنالیز آزمایشگاهی مستند.", type: "physical", priceToman: 4350000, compareAtToman: null, emoji: "🥛", status: "active", stock: 40, badge: "" },
  { slug: "program-hypertrophy-12w", nameFa: "برنامه ۱۲ هفته هیپرتروفی (دانلودی)", description: "برنامه پی‌دی‌اف + ویدیوی تکنیک ۲۰ حرکت؛ قابل بارگذاری در اسی‌فیت.", type: "digital", priceToman: 980000, compareAtToman: null, emoji: "📘", status: "active", stock: 999, badge: "جدید" },
  { slug: "foam-roller", nameFa: "فوم رولر مشبک", description: "سطح مشبک برای میوفاسیال ریلیز؛ طول ۴۵ سانتی‌متر.", type: "physical", priceToman: 520000, compareAtToman: null, emoji: "🧵", status: "active", stock: 60, badge: "" },
  { slug: "gym-towel-pro", nameFa: "حوله باشگاه میکروفایبر", description: "خشک‌کن سریع، ضدبو؛ ۹۰×۴۰ سانتی‌متر با بند آویز.", type: "physical", priceToman: 245000, compareAtToman: 320000, emoji: "🧺", status: "active", stock: 150, badge: "" },
  { slug: "meal-prep-boxes", nameFa: "ست ظروف میل‌پرپ ۷ عددی", description: "بدون BPA، مناسب فریزر و مایکروویو؛ برای پیش‌آماده‌سازی غذای هفته.", type: "physical", priceToman: 780000, compareAtToman: null, emoji: "🍱", status: "active", stock: 45, badge: "" },
];

export const SUBSCRIPTION_PLANS = [
  {
    code: "vip_monthly", tier: "vip", nameFa: "وی‌آی‌پی ماهانه", billingPeriod: "monthly",
    priceToman: 249000, currency: "IRT", active: true, highlight: true,
    featuresFa: JSON.stringify([
      "تحلیل پیشرفت پیشرفته (رادار بدن، نقشه عضلات)",
      "۱۲ ماه تاریخچه تمرین و تغذیه",
      "۶۰ پیام ماهانه دستیار هوشمند",
      "گزارش هفتگی + اشتراک‌گذاری",
      "۵٪ تخفیف فروشگاه",
    ]),
  },
  {
    code: "vip_yearly", tier: "vip", nameFa: "وی‌آی‌پی سالانه", billingPeriod: "yearly",
    priceToman: 2390000, currency: "IRT", active: true, highlight: false,
    featuresFa: JSON.stringify([
      "همه مزایای وی‌آی‌پی ماهانه",
      "دو ماه رایگان نسبت به پرداخت ماهانه",
      "۱۲۰ پیام ماهانه دستیار هوشمند",
      "۵٪ تخفیف فروشگاه",
    ]),
  },
  {
    code: "vip_plus_monthly", tier: "vip_plus", nameFa: "وی‌آی‌پی پلاس", billingPeriod: "monthly",
    priceToman: 449000, currency: "IRT", active: true, highlight: false,
    featuresFa: JSON.stringify([
      "همه مزایای وی‌آی‌پی",
      "۳۶ ماه تاریخچه کامل",
      "۲۰۰ پیام ماهانه دستیار هوشمند + زمینه عمیق",
      "۱۰٪ تخفیف فروشگاه",
      "اولویت دسترسی به قابلیت‌های جدید",
    ]),
  },
  {
    code: "coach_monthly", tier: "coach", nameFa: "حساب مربی", billingPeriod: "monthly",
    priceToman: 890000, currency: "IRT", active: true, highlight: false,
    featuresFa: JSON.stringify([
      "پنل مدیریت شاگردان و برنامه‌ریزی",
      "انتشار برنامه در بازار مربیان",
      "گزارش پیشرفت شاگردان",
      "۱۰٪ تخفیف فروشگاه",
    ]),
  },
];
