/**
 * Persian-focused food database — per-serving nutrition values curated from
 * standard food-composition references (USDA + Iranian food composition tables).
 * Values are per declared serving; quantities are approximations for logging UX,
 * not clinical data. kcal rounded, macros in grams.
 */

export type FoodSeed = {
  slug: string;
  nameFa: string;
  category:
    | "persian_dishes"
    | "protein"
    | "grains"
    | "dairy"
    | "fruit"
    | "vegetables"
    | "nuts"
    | "snacks"
    | "beverages"
    | "fast_food"
    | "breakfast"
    | "general";
  servingAmount: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
};

const g = (slug: string, nameFa: string, category: FoodSeed["category"], amount: number, unit: string, kcal: number, p: number, c: number, f: number, fib = 0, na = 0): FoodSeed => ({
  slug, nameFa, category, servingAmount: amount, servingUnit: unit,
  calories: kcal, proteinG: p, carbsG: c, fatG: f, fiberG: fib, sodiumMg: na,
});

export const FOODS: FoodSeed[] = [
  // ------- Persian dishes -------
  g("chelo-kabab-kubideh", "چلوکباب کوبیده", "persian_dishes", 1, "سیخ با برنج", 850, 38, 95, 30, 3, 780),
  g("chelo-joojeh", "چلوجوجه", "persian_dishes", 1, "نصف مرغ با برنج", 720, 45, 88, 18, 3, 640),
  g("ghormeh-sabzi", "خورش قورمه‌سبزی", "persian_dishes", 1, "بشقاب خورش", 320, 18, 14, 22, 5, 690),
  g("ghimeh", "خورش قیمه", "persian_dishes", 1, "بشقاب خورش", 360, 17, 24, 21, 5, 720),
  g("fesenjan", "خورش فسنجان", "persian_dishes", 1, "بشقاب خورش", 480, 15, 20, 38, 3, 480),
  g("khoresh-bademjan", "خورش بادمجان", "persian_dishes", 1, "بشقاب خورش", 300, 12, 18, 21, 4, 520),
  g("kuku-sabzi", "کوکو سبزی", "persian_dishes", 1, "عدد متوسط", 130, 6, 6, 9, 1, 220),
  g("kotlet", "کتلت", "persian_dishes", 1, "عدد", 180, 8, 12, 11, 1, 340),
  g("shami", "شامی", "persian_dishes", 1, "عدد", 150, 9, 10, 8, 1, 300),
  g("ash-reshteh", "آش رشته", "persian_dishes", 1, "کاسه بزرگ", 340, 11, 48, 10, 8, 640),
  g("abgoosht", "آبگوشت", "persian_dishes", 1, "کاسه", 520, 28, 38, 27, 6, 760),
  g("dizi-tajik", "دیزی", "persian_dishes", 1, "دیزی", 620, 30, 45, 34, 6, 840),
  g("tahchin", "ته‌چین مرغ", "persian_dishes", 1, "برش", 420, 20, 52, 13, 1, 520),
  g("mirzaghasemi", "میرزا قاسمی", "persian_dishes", 1, "بشقاب کوچک", 240, 7, 14, 17, 4, 460),
  g("loobia-polo", "لوبیا پلو", "persian_dishes", 1, "بشقاب", 480, 17, 72, 14, 6, 580),
  g("zereshk-polo-morgh", "زعفرانی زرشک‌پلو با مرغ", "persian_dishes", 1, "بشقاب", 690, 42, 85, 18, 3, 610),
  g("kashk-bademjan", "کشک بادمجان", "persian_dishes", 1, "بشقاب کوچک", 260, 8, 12, 20, 4, 420),
  g("adasi", "عدسی", "persian_dishes", 1, "کاسه", 230, 13, 34, 4, 12, 380),

  // ------- Protein -------
  g("chicken-breast-grilled", "سینه مرغ گریل", "protein", 100, "گرم", 165, 31, 0, 4, 0, 74),
  g("chicken-thigh", "ران مرغ", "protein", 100, "گرم", 209, 26, 0, 11, 0, 88),
  g("ground-beef-lean", "گوشت چرخ‌کرده کم‌چرب", "protein", 100, "گرم", 214, 26, 0, 12, 0, 72),
  g("lamb-chop", "دنبه و ران بره", "protein", 100, "گرم", 294, 25, 0, 21, 0, 72),
  g("fish-white", "ماهی سفید", "protein", 100, "گرم", 118, 24, 0, 2, 0, 90),
  g("salmon", "سالمون", "protein", 100, "گرم", 208, 20, 0, 13, 0, 59),
  g("tuna-canned", "تن ماهی", "protein", 100, "گرم", 128, 26, 0, 2, 0, 320),
  g("shrimp", "میگو", "protein", 100, "گرم", 99, 24, 0, 0.3, 0, 111),
  g("egg", "تخم‌مرغ", "protein", 1, "عدد متوسط", 72, 6.3, 0.4, 5, 0, 71),
  g("egg-white", "سفیده تخم‌مرغ", "protein", 1, "عدد", 17, 3.6, 0.2, 0.1, 0, 55),
  g("soy-protein", "سویای پروتئینه", "protein", 100, "گرم", 172, 52, 9, 1, 4, 40),
  g("whey-scoop", "پودر پروتئین وی", "protein", 30, "اسکوپ", 120, 24, 3, 1.5, 0, 60),
  g("tofu", "توفو", "protein", 100, "گرم", 76, 8, 1.9, 4.8, 0.3, 7),

  // ------- Grains & carbs -------
  g("rice-white-cooked", "برنج سفید پخته", "grains", 200, "گرم", 260, 5, 56, 0.6, 1, 2),
  g("rice-brown-cooked", "برنج قهوه‌ای پخته", "grains", 200, "گرم", 248, 5, 52, 2, 3, 4),
  g("bread-sangak", "نان سنگک", "grains", 100, "گرم", 250, 8, 50, 1.5, 3, 380),
  g("bread-barbari", "نان بربری", "grains", 100, "گرم", 280, 8, 55, 2, 2.5, 450),
  g("bread-lavash", "نان لواش", "grains", 50, "برش", 130, 4, 27, 0.8, 1, 320),
  g("oats-dry", "جو دوسر خشک", "grains", 40, "گرم", 152, 5, 27, 2.8, 4, 2),
  g("pasta-cooked", "ماکارونی پخته", "grains", 200, "گرم", 262, 9, 52, 1.6, 2.6, 6),
  g("potato-baked", "سیب‌زمینی آب‌پز", "grains", 150, "گرم", 130, 3, 30, 0.2, 2.7, 8),
  g("sweet-potato", "سیب‌زمینی شیرین", "grains", 150, "گرم", 129, 2.4, 30, 0.2, 4.8, 68),
  g("kate-bread", "نان کته", "grains", 100, "گرم", 270, 7, 55, 1.2, 2, 300),

  // ------- Dairy -------
  g("milk-lowfat", "شیر کم‌چرب", "dairy", 250, "لیوان", 122, 8, 12, 4.8, 0, 116),
  g("greek-yogurt", "ماست یونانی", "dairy", 150, "گرم", 146, 15, 6, 6.6, 0, 55),
  g("yogurt-plain", "ماست ساده", "dairy", 150, "گرم", 90, 5, 7, 4.5, 0, 60),
  g("doogh", "دوغ", "beverages", 250, "لیوان", 85, 4, 7, 3.5, 0, 580),
  g("cheese-feta", "پنیر بری", "dairy", 30, "گرم", 80, 4.5, 1.2, 6.4, 0, 480),
  g("cheese-lighvan", "پنیر لیقوان", "dairy", 30, "گرم", 85, 5.5, 1, 6.8, 0, 520),
  g("kashk", "کشک", "dairy", 30, "گرم", 90, 5, 4, 6, 0, 320),
  g("feta-white-cheese-toast", "پنیر سرخ‌کرده", "dairy", 40, "گرم", 120, 7, 2, 9.5, 0, 540),

  // ------- Fruit -------
  g("apple", "سیب", "fruit", 1, "عدد متوسط", 95, 0.5, 25, 0.3, 4.4, 2),
  g("banana", "موز", "fruit", 1, "عدد متوسط", 105, 1.3, 27, 0.4, 3.1, 1),
  g("orange", "پرتقال", "fruit", 1, "عدد متوسط", 62, 1.2, 15, 0.2, 3.1, 0),
  g("dates", "خرما", "fruit", 3, "عدد", 200, 0.6, 54, 0.2, 4.8, 1),
  g("watermelon", "هندوانه", "fruit", 200, "گرم", 60, 1.2, 15, 0.3, 0.6, 3),
  g("grapes", "انگور", "fruit", 150, "گرم", 104, 1.1, 27, 0.2, 1.4, 4),
  g("pomegranate", "انار", "fruit", 150, "گرم", 125, 2.4, 28, 1.8, 5.6, 5),
  g("berries-mix", "توت فرنگی", "fruit", 150, "گرم", 48, 1, 11, 0.5, 3, 2),
  g("melon", "طالبی", "fruit", 200, "گرم", 68, 1.7, 16, 0.4, 3, 32),

  // ------- Vegetables -------
  g("salad-shirazi", "سالاد شیرازی", "vegetables", 200, "گرم", 70, 1.8, 10, 3.2, 3, 320),
  g("mixed-salad", "سالاد فصل", "vegetables", 200, "گرم", 85, 2.2, 9, 4.8, 3.5, 240),
  g("cucumber", "خیار", "vegetables", 100, "گرم", 15, 0.7, 3.6, 0.1, 0.5, 2),
  g("tomato", "گوجه", "vegetables", 100, "گرم", 18, 0.9, 3.9, 0.2, 1.2, 5),
  g("steamed-vegetables", "سبزیجات بخارپز", "vegetables", 200, "گرم", 70, 3.5, 12, 0.8, 5, 40),
  g("pickled-vegetables", "ترشی مخلوط", "vegetables", 50, "گرم", 20, 0.6, 3.5, 0.3, 1.5, 640),
  g("fresh-herbs", "سبزی خوردن", "vegetables", 60, "گرم", 22, 2, 3.4, 0.4, 2, 30),

  // ------- Nuts & seeds -------
  g("almonds", "بادام", "nuts", 28, "گرم", 164, 6, 6, 14, 3.5, 1),
  g("walnuts", "گردو", "nuts", 28, "گرم", 185, 4.3, 3.9, 18.5, 1.9, 1),
  g("pistachio", "پسته", "nuts", 28, "گرم", 159, 6, 8, 13, 3, 160),
  g("peanuts", "بادام زمینی", "nuts", 28, "گرم", 161, 7.3, 4.6, 14, 2.4, 5),
  g("peanut-butter", "کره بادام زمینی", "nuts", 32, "قاشق غذاخوری", 190, 8, 6, 16, 2, 140),
  g("sunflower-seeds", "دانه آفتابگردان", "nuts", 28, "گرم", 165, 5.8, 5.6, 14, 2.4, 2),

  // ------- Breakfast -------
  g("omelette-2egg", "املت دو تخم‌مرغی", "breakfast", 1, "پرس", 230, 13, 4, 18, 0.8, 380),
  g("haleem", "حلیم", "breakfast", 1, "کاسه", 380, 15, 48, 13, 6, 420),
  g("kalle-pache", "کله‌پاچه", "breakfast", 1, "پرس", 560, 32, 8, 42, 0, 780),
  g("pancake-2", "پنکیک", "breakfast", 2, "عدد", 280, 7, 40, 10, 1.5, 380),

  // ------- Fast food -------
  g("pizza-slice", "پیتزا", "fast_food", 1, "برش", 285, 12, 36, 10, 2.3, 640),
  g("burger-classic", "برگر", "fast_food", 1, "عدد", 540, 25, 42, 29, 2, 820),
  g("french-fries", "سیب‌زمینی سرخ‌کرده", "fast_food", 120, "گرم", 365, 4, 48, 17, 3.8, 210),
  g("sandwich-tuna", "ساندویچ تن ماهی", "fast_food", 1, "عدد", 380, 22, 38, 15, 3, 620),
  g("falafel-wrap", "ساندویچ فلافل", "fast_food", 1, "عدد", 430, 13, 52, 19, 6, 780),
  g("fried-chicken", "مرغ سوخاری", "fast_food", 150, "گرم", 430, 30, 18, 26, 1.2, 690),

  // ------- Snacks -------
  g("dark-chocolate", "شکلات تلخ", "snacks", 25, "گرم", 145, 2, 10, 11, 2.4, 5),
  g("biscuit", "بیسکویت", "snacks", 30, "گرم", 140, 2, 20, 6, 0.8, 120),
  g("ice-cream", "بستنی", "snacks", 100, "گرم", 207, 3.5, 24, 11, 0.7, 80),
  g("chips", "چیپس", "snacks", 30, "گرم", 160, 2, 15, 10, 1.2, 170),
  g("protein-bar", "میله پروتئین", "snacks", 1, "عدد", 210, 20, 22, 7, 5, 200),
  g("sohan", "سوهان", "snacks", 30, "گرم", 165, 3, 18, 9.5, 1, 55),
  g("gaz", "گز", "snacks", 30, "گرم", 130, 1.5, 24, 4, 0.5, 20),

  // ------- Beverages -------
  g("coffee-black", "قهوه تلخ", "beverages", 240, "فنجان", 5, 0.3, 0, 0, 0, 5),
  g("tea-black", "چای", "beverages", 240, "استکان", 2, 0, 0.5, 0, 0, 2),
  g("orange-juice", "آب پرتقال", "beverages", 250, "لیوان", 112, 1.7, 26, 0.5, 0.5, 2),
  g("cola", "نوشابه", "beverages", 330, "قوطی", 139, 0, 35, 0, 0, 10),
  g("beer-nonalc-malt", "نوشیدنی مالت", "beverages", 330, "قوطی", 130, 0.5, 31, 0, 0, 15),
  g("water", "آب", "beverages", 250, "لیوان", 0, 0, 0, 0, 0, 2),
];

export const FOOD_CATEGORIES_FA: Record<FoodSeed["category"], string> = {
  persian_dishes: "غذای ایرانی",
  protein: "منابع پروتئین",
  grains: "نان و غلات",
  dairy: "لبنیات",
  fruit: "میوه",
  vegetables: "سبزیجات",
  nuts: "آجیل و دانه",
  snacks: "میان‌وعده",
  beverages: "نوشیدنی",
  fast_food: "فست‌فود",
  breakfast: "صبحانه",
  general: "سایر",
};
