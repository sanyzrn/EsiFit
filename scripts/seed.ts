import { PrismaClient } from "@prisma/client";
import { EXERCISES, MUSCLE_GROUPS } from "../src/features/workouts/data/exercise-dataset";
import { FOODS } from "../src/features/nutrition/data/food-database";
import { ARTICLES } from "../src/features/content/data/articles";
import { PRODUCTS, SUBSCRIPTION_PLANS, BADGES, MISSIONS, CHALLENGES, COMMUNITY_POSTS } from "../src/features/content/data/catalog";
import { computeReadiness, oneRepMax } from "../src/lib/domain/body-math";
import { generateReadinessFactorsJson } from "../src/lib/domain/readiness-factors";

const db = new PrismaClient();

/** Deterministic PRNG — same seed = same world. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260901);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  console.log("🌱 Seeding EsiFit (deterministic seed 20260901)…");

  // Wipe in FK-safe order
  await db.$transaction([
    db.aiMessage.deleteMany(), db.aiUsageLog.deleteMany(), db.aiConversation.deleteMany(),
    db.order.deleteMany(), db.subscription.deleteMany(), db.subscriptionPlan.deleteMany(), db.product.deleteMany(),
    db.articleSource.deleteMany(), db.article.deleteMany(), db.author.deleteMany(), db.category.deleteMany(),
    db.notification.deleteMany(), db.postLike.deleteMany(), db.comment.deleteMany(), db.post.deleteMany(),
    db.challengeParticipant.deleteMany(), db.challenge.deleteMany(),
    db.userMissionProgress.deleteMany(), db.mission.deleteMany(),
    db.userBadge.deleteMany(), db.badge.deleteMany(),
    db.xpLog.deleteMany(),
    db.setLog.deleteMany(), db.exerciseLog.deleteMany(), db.workoutSession.deleteMany(),
    db.plannedExercise.deleteMany(), db.workoutPlanDay.deleteMany(), db.workoutPlan.deleteMany(),
    db.personalRecord.deleteMany(), db.painReport.deleteMany(), db.exerciseSwap.deleteMany(),
    db.mealEntry.deleteMany(), db.nutritionDay.deleteMany(), db.nutritionTarget.deleteMany(),
    db.waterLog.deleteMany(), db.sleepLog.deleteMany(), db.calculatorResult.deleteMany(),
    db.readinessDaily.deleteMany(), db.bodyMeasurement.deleteMany(), db.goal.deleteMany(),
    db.exerciseMuscle.deleteMany(), db.exercise.deleteMany(), db.muscleGroup.deleteMany(),
    db.food.deleteMany(),
    db.coachClient.deleteMany(), db.weeklyRecap.deleteMany(),
    db.userProfile.deleteMany(), db.session.deleteMany(), db.otpCode.deleteMany(), db.otpRequestLog.deleteMany(),
    db.user.deleteMany(),
  ]);

  // ---------- Exercises ----------
  const mgRows = await Promise.all(
    MUSCLE_GROUPS.map((m) => db.muscleGroup.create({ data: m })),
  );
  const mgBySlug = new Map(mgRows.map((m) => [m.slug, m.id]));

  const exRows: Array<{ id: string; slug: string }> = [];
  for (const ex of EXERCISES) {
    const row = await db.exercise.create({
      data: {
        slug: ex.slug,
        nameFa: ex.nameFa,
        equipment: ex.equipment,
        movementPattern: ex.movementPattern,
        difficulty: ex.difficulty,
        isUnilateral: ex.isUnilateral ?? false,
        isCompound: ex.isCompound,
        instructionsFa: ex.instructionsFa,
        cuesJson: "[]",
      },
    });
    exRows.push({ id: row.id, slug: ex.slug });
    for (const m of ex.muscles) {
      await db.exerciseMuscle.create({
        data: { exerciseId: row.id, muscleGroupId: mgBySlug.get(m.slug)!, role: m.role, intensity: m.intensity },
      });
    }
  }
  const exBySlug = new Map(exRows.map((x) => [x.slug, x.id]));
  console.log(`  ✓ ${exRows.length} exercises, ${mgRows.length} muscle groups`);

  // ---------- Foods ----------
  for (const f of FOODS) await db.food.create({ data: f });
  console.log(`  ✓ ${FOODS.length} foods`);

  // ---------- Badges / Missions / Challenges ----------
  for (const b of BADGES) await db.badge.create({ data: b });
  for (const m of MISSIONS) await db.mission.create({ data: m });
  for (const c of CHALLENGES) {
    await db.challenge.create({
      data: { ...c, startDate: dateOnly(isoDaysAgo(5)), endDate: dateOnly(isoDaysAgo(-25)) },
    });
  }

  // ---------- Community users ----------
  const communityUsersData = [
    { phone: "09121110001", displayName: "سارا محمدی", tier: "vip" },
    { phone: "09121110002", displayName: "رضا کریمی", tier: "free" },
    { phone: "09121110003", displayName: "نگین احمدی", tier: "vip_plus" },
    { phone: "09121110004", displayName: "علی رضایی", tier: "free" },
    { phone: "09121110005", displayName: "مهدی توکلی", tier: "vip" },
    { phone: "09121110006", displayName: "مریم صادقی", tier: "free" },
  ];
  const communityUsers: Awaited<ReturnType<typeof db.user.create>>[] = [];
  for (const u of communityUsersData) {
    communityUsers.push(await db.user.create({ data: { ...u, role: "member" } }));
  }

  // ---------- Demo user ----------
  const demo = await db.user.create({
    data: {
      phone: "09120000000",
      displayName: "امیر رضایی",
      tier: "vip",
      role: "member",
    },
  });
  await db.userProfile.create({
    data: {
      userId: demo.id,
      birthYear: 1374,
      sexAtBirth: "male",
      heightCm: 178,
      primaryGoal: "build_muscle",
      experienceLevel: "intermediate",
      activityLevel: "moderate",
      dailyCalorieTarget: 2680,
      dailyProteinTarget: 158,
      dailyCarbTarget: 330,
      dailyFatTarget: 75,
      dailyWaterTargetMl: 2600,
      weeklyWorkoutTarget: 4,
      onboardedAt: isoDaysAgo(95),
    },
  });
  await db.nutritionTarget.create({
    data: {
      userId: demo.id,
      effectiveFrom: dateOnly(isoDaysAgo(90)),
      calories: 2680, proteinG: 158, carbsG: 330, fatG: 75, fiberG: 32,
    },
  });

  // ---------- 90 days of history ----------
  const trainingDaySet = new Set<number>();
  for (let day = 90; day >= 0; day--) {
    const d = isoDaysAgo(day);
    const dow = d.getUTCDay();
    const planned = [0, 1, 3, 4].includes(dow);
    if (planned && rand() > 0.15) trainingDaySet.add(day);
  }
  const trainingDays = [...trainingDaySet].sort((a, b) => a - b);

  const slugs = ["barbell-bench-press", "barbell-row", "barbell-squat", "overhead-press", "deadlift", "lat-pulldown", "leg-press", "romanian-deadlift", "dumbbell-shoulder-press", "seated-cable-row", "biceps-curl", "triceps-pushdown", "leg-curl", "leg-extension", "lateral-raise", "hip-thrust", "incline-dumbbell-press", "dumbbell-row", "calf-raise", "plank", "face-pull", "pull-up"];

  let prCount = 0;
  for (const day of trainingDays) {
    const d = isoDaysAgo(day);
    const startedAt = new Date(d);
    startedAt.setUTCHours(17, Math.floor(rand() * 3) + 17, 0, 0);
    const durationSec = Math.round(between(45, 75) * 60);
    const endedAt = new Date(startedAt.getTime() + durationSec * 1000);

    const session = await db.workoutSession.create({
      data: {
        userId: demo.id,
        name: pick(["پرس و زیربغل", "روز پا", "سرشانه و بازو", "تمرین ترکیبی", "ددلیفت و پشت"]),
        startedAt,
        endedAt,
        durationSeconds: durationSec,
        status: "completed",
        syncStatus: "synced",
        totalVolumeKg: 0,
      },
    });

    const count = 4 + Math.floor(rand() * 3);
    const chosen = new Set<string>();
    let sessionVol = 0;
    for (let i = 0; i < count; i++) {
      const slug = pick(slugs);
      if (chosen.has(slug)) continue;
      chosen.add(slug);
      const exerciseId = exBySlug.get(slug)!;
      const log = await db.exerciseLog.create({
        data: { sessionId: session.id, exerciseId, orderIndex: i },
      });

      const progression = 1 + (90 - day) / 400;
      const baseWeights: Record<string, number> = {
        "barbell-bench-press": 60, "barbell-row": 55, "barbell-squat": 80, "overhead-press": 38,
        "deadlift": 100, "lat-pulldown": 55, "leg-press": 130, "romanian-deadlift": 65,
        "dumbbell-shoulder-press": 18, "seated-cable-row": 50, "biceps-curl": 22, "triceps-pushdown": 30,
        "leg-curl": 40, "leg-extension": 50, "lateral-raise": 9, "hip-thrust": 70,
        "incline-dumbbell-press": 22, "dumbbell-row": 26, "calf-raise": 60, "plank": 0,
        "face-pull": 20, "pull-up": 0,
      };
      const base = (baseWeights[slug] ?? 30) * progression;
      const sets = 3 + (rand() > 0.6 ? 1 : 0);
      let newPr = false;
      for (let s = 0; s < sets; s++) {
        const w = Math.round(base * between(0.92, 1.05));
        const reps = Math.max(3, Math.round(between(6, 12)));
        if (w > 0 && reps > 0) sessionVol += w * reps;
        const weight = slug === "plank" || slug === "pull-up" ? null : w;
        const isPrSet = !newPr && weight != null && reps >= 10 && rand() > 0.985 && day < 80;
        if (isPrSet) newPr = true;
        await db.setLog.create({
          data: {
            exerciseLogId: log.id,
            setNumber: s + 1,
            weightKg: weight,
            reps: slug === "plank" ? 1 : reps,
            rpe: Math.round(between(6.5, 9) * 2) / 2,
            durationSeconds: slug === "plank" ? 45 + Math.floor(rand() * 30) : null,
            isPr: isPrSet,
            completedAt: new Date(startedAt.getTime() + (s + 1) * 180_000),
          },
        });
        if (isPrSet) {
          prCount++;
          const orm = oneRepMax(weight!, reps!).recommended;
          const pr = await db.personalRecord.create({
            data: {
              userId: demo.id, exerciseId, recordType: "weight", value: orm, unit: "kg",
              workoutSessionId: session.id, achievedAt: startedAt, isCurrent: true,
            },
          });
          const prevs = await db.personalRecord.findMany({
            where: { userId: demo.id, exerciseId, recordType: "weight", isCurrent: true, NOT: { id: pr.id } },
          });
          for (const p of prevs) {
            await db.personalRecord.update({ where: { id: p.id }, data: { isCurrent: false } });
          }
        }
      }
    }
    await db.workoutSession.update({ where: { id: session.id }, data: { totalVolumeKg: sessionVol } });

    await db.xpLog.create({
      data: { userId: demo.id, amount: 60 + Math.floor(rand() * 30), sourceType: "workout", sourceId: session.id, createdAt: endedAt },
    });

    let clientSeq = 0;
    for (let glass = 0; glass < 8 + Math.floor(rand() * 4); glass++) {
      const loggedAt = new Date(startedAt.getTime() + glass * 90 * 60 * 1000);
      await db.waterLog.create({
        data: {
          userId: demo.id, ml: 250, loggedAt, logDate: dateOnly(d),
          syncStatus: "synced", clientId: `seed-${day}-${clientSeq++}`,
        },
      });
    }
  }

  // Water on recent non-training days
  let seq = 1000;
  for (let day = 30; day >= 0; day--) {
    if (trainingDaySet.has(day)) continue;
    const d = isoDaysAgo(day);
    for (let glass = 0; glass < 5 + Math.floor(rand() * 4); glass++) {
      await db.waterLog.create({
        data: {
          userId: demo.id, ml: 250,
          loggedAt: new Date(d.getTime() + glass * 120 * 60 * 1000),
          logDate: dateOnly(d), syncStatus: "synced", clientId: `seed-rest-${seq++}`,
        },
      });
    }
  }

  // ---------- Body measurements ----------
  for (let week = 12; week >= 0; week--) {
    const d = isoDaysAgo(week * 7);
    const weight = 84.2 - (12 - week) * 0.26 + between(-0.15, 0.15);
    await db.bodyMeasurement.create({
      data: {
        userId: demo.id, measuredOn: dateOnly(d),
        weightKg: Math.round(weight * 10) / 10,
        bodyFatPct: week % 2 === 0 ? Math.round((19.5 - (12 - week) * 0.22) * 10) / 10 : null,
        waistCm: week % 2 === 0 ? Math.round(88 - (12 - week) * 0.3) : null,
        note: week === 0 ? "اندازه‌گیری امروز" : null,
      },
    });
  }

  // ---------- Sleep logs ----------
  for (let day = 30; day >= 1; day--) {
    const wake = isoDaysAgo(day);
    const start = new Date(wake); start.setDate(start.getDate() - 1); start.setUTCHours(23, Math.floor(rand() * 60) - 30, 0, 0);
    const end = new Date(wake); end.setUTCHours(6 + Math.floor(rand() * 2), Math.floor(rand() * 60), 0, 0);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    await db.sleepLog.create({
      data: {
        userId: demo.id, sleepStart: start, sleepEnd: end, durationMinutes,
        qualityScore: Math.min(100, Math.max(40, Math.round(55 + durationMinutes / 10 + between(-10, 15)))),
        restingHrBpm: Math.round(between(52, 62)), hrvMs: Math.round(between(55, 85)),
        source: "manual", logDate: dateOnly(wake),
      },
    });
  }

  // ---------- Readiness (14 days) ----------
  for (let day = 14; day >= 0; day--) {
    const d = isoDaysAgo(day);
    const sleep = await db.sleepLog.findFirst({ where: { userId: demo.id, logDate: dateOnly(d) } });
    const load3 = [...trainingDaySet].filter((t) => t >= day && t < day + 3).length * 4000;
    const load14 = [...trainingDaySet].filter((t) => t >= day && t < day + 14).length * 4000;
    const firstUpcoming = [...trainingDaySet].find((t) => t >= day);
    const r = computeReadiness({
      sleepQualityScore: sleep?.qualityScore ?? null,
      sleepDurationMinutes: sleep?.durationMinutes ?? null,
      trainingLoadLast3Days: load3 || null,
      avgTrainingLoad14d: load14 || null,
      adherenceLast7d: 0.75 + rand() * 0.2,
      daysSinceLastWorkout: firstUpcoming != null ? firstUpcoming - day : null,
    });
    await db.readinessDaily.create({
      data: {
        userId: demo.id, scoreDate: dateOnly(d), score: r.score, state: r.state,
        calculationVersion: "v1", isEstimated: true,
        factorsJson: generateReadinessFactorsJson(r.factors),
      },
    });
  }

  // ---------- Nutrition last 3 days ----------
  const mealPlan = [
    { slot: "breakfast", slug: "omelette-2egg", qty: 1 },
    { slot: "breakfast", slug: "bread-sangak", qty: 0.8 },
    { slot: "lunch", slug: "zereshk-polo-morgh", qty: 1 },
    { slot: "lunch", slug: "doogh", qty: 0.5 },
    { slot: "snack", slug: "whey-scoop", qty: 1 },
    { slot: "snack", slug: "banana", qty: 1 },
    { slot: "dinner", slug: "chicken-breast-grilled", qty: 1.8 },
    { slot: "dinner", slug: "rice-white-cooked", qty: 1 },
    { slot: "dinner", slug: "mixed-salad", qty: 1 },
  ];
  const foodRows = await db.food.findMany({ where: { slug: { in: mealPlan.map((m) => m.slug) } } });
  const foodBySlug = new Map(foodRows.map((f) => [f.slug, f.id]));
  for (let day = 2; day >= 0; day--) {
    const nd = await db.nutritionDay.create({
      data: { userId: demo.id, logDate: dateOnly(isoDaysAgo(day)) },
    });
    for (const m of mealPlan) {
      const foodId = foodBySlug.get(m.slug);
      if (!foodId) continue;
      await db.mealEntry.create({
        data: {
          nutritionDayId: nd.id, foodId, mealSlot: m.slot,
          quantity: m.qty, servingMultiplier: m.qty,
          clientId: `seed-meal-${day}-${m.slug}-${m.slot}`,
        },
      });
    }
  }

  // ---------- Goal ----------
  await db.goal.create({
    data: {
      userId: demo.id, type: "weight", title: "رسیدن به ۷۹ کیلو با حفظ عضله",
      startValue: 84.2, targetValue: 79, unit: "kg",
      startDate: dateOnly(isoDaysAgo(84)), targetDate: dateOnly(isoDaysAgo(-60)), status: "active",
    },
  });

  // ---------- Badges for demo ----------
  const badges = await db.badge.findMany();
  let bd = 80;
  for (const b of badges) {
    let earned = false;
    if (b.criteriaType === "workout_count" && b.criteriaValue <= trainingDays.length) earned = true;
    if (b.criteriaType === "pr_count" && b.criteriaValue <= prCount) earned = true;
    if (b.criteriaType === "streak" && b.criteriaValue <= 14) earned = true;
    if (b.criteriaType === "volume" && b.criteriaValue <= 10000) earned = true;
    if (b.criteriaType === "water_days" || b.criteriaType === "nutrition_days" || b.criteriaType === "early") earned = true;
    if (earned) {
      bd -= 6;
      const at = isoDaysAgo(Math.max(1, bd));
      await db.userBadge.create({ data: { userId: demo.id, badgeId: b.id, earnedAt: at } });
      await db.xpLog.create({
        data: { userId: demo.id, amount: 40, sourceType: "badge", sourceId: b.id, createdAt: at },
      });
    }
  }

  // ---------- Missions progress (today) ----------
  const today = dateOnly(isoDaysAgo(0));
  const missions = await db.mission.findMany();
  for (const m of missions) {
    const progress =
      m.criteriaType === "workout" ? (trainingDaySet.has(0) ? 1 : 0)
      : m.criteriaType === "water_ml" ? 2250
      : m.criteriaType === "sets_logged" ? 12
      : m.criteriaType === "protein_hit" ? 0
      : 1;
    await db.userMissionProgress.create({
      data: {
        userId: demo.id, missionId: m.id, periodKey: m.period === "daily" ? today : dateOnly(isoDaysAgo(2)),
        progress, target: m.target, claimed: false,
        completedAt: progress >= m.target ? new Date() : null,
      },
    });
  }

  // ---------- Community ----------
  for (const p of COMMUNITY_POSTS) {
    const author = communityUsers[Math.floor(rand() * communityUsers.length)];
    const row = await db.post.create({
      data: {
        userId: author.id,
        content: p.content,
        workoutType: p.workoutType ?? null,
        visibility: "public",
        createdAt: new Date(Date.now() - p.hoursAgo * 3600 * 1000),
      },
    });
    const likers = communityUsers.filter(() => rand() > 0.4);
    if (rand() > 0.5) likers.push(demo);
    for (const l of likers) {
      await db.postLike.create({ data: { postId: row.id, userId: l.id } }).catch(() => undefined);
    }
    for (const c of p.comments ?? []) {
      await db.comment.create({
        data: {
          postId: row.id,
          userId: communityUsers[Math.floor(rand() * communityUsers.length)].id,
          content: c,
          createdAt: new Date(Date.now() - (p.hoursAgo - 1) * 3600 * 1000),
        },
      });
    }
  }
  await db.post.create({
    data: {
      userId: demo.id,
      content: "امروز پرس سینه ۸۰ کیلو زدم — رکورد شخصی جدید! 🎉 ممنون از برنامه‌ریزی اسی‌فیت که پیشرفت رو قابل اندازه‌گیری کرده.",
      workoutType: "chest",
      visibility: "public",
      createdAt: new Date(Date.now() - 5 * 3600 * 1000),
    },
  });

  // Challenge participation
  const challenges = await db.challenge.findMany();
  for (const ch of challenges) {
    await db.challengeParticipant.create({ data: { challengeId: ch.id, userId: demo.id, score: Math.round(between(8, 20)) } });
    for (const u of communityUsers) {
      if (rand() > 0.35) {
        await db.challengeParticipant.create({ data: { challengeId: ch.id, userId: u.id, score: Math.round(between(2, 26)) } }).catch(() => undefined);
      }
    }
  }

  // ---------- Notifications ----------
  const notifs = [
    { type: "achievement", title: "نشان «مصمم» فعال شد", body: "۲۵ تمرین کامل انجام دادی. نشان جدید به مجموعه‌ات اضافه شد.", actionUrl: "/achievements", hoursAgo: 6 },
    { type: "social", title: "سارا محمدی پست شما را پسندید", body: "پست رکورد پرس سینه شما محبوب شد.", actionUrl: "/community", hoursAgo: 4 },
    { type: "reminder", title: "یادآوری آب", body: "امروز ۹۰۰ میلی‌لیتر تا هدف آب کافی فاصله داری.", actionUrl: "/nutrition", hoursAgo: 2 },
    { type: "system", title: "به‌روزرسانی اسی‌فیت", body: "نسخه جدید با حالت تمرین زنده بهبودیافته منتشر شد.", actionUrl: null, hoursAgo: 30 },
    { type: "achievement", title: "رکورد شخصی جدید", body: "ددلیفت — رکورد جدید ثبت شد", actionUrl: "/analytics", hoursAgo: 52 },
  ];
  for (const n of notifs) {
    await db.notification.create({
      data: {
        userId: demo.id, type: n.type, title: n.title, body: n.body, actionUrl: n.actionUrl,
        createdAt: new Date(Date.now() - n.hoursAgo * 3600 * 1000),
        readAt: n.hoursAgo > 24 ? new Date(Date.now() - (n.hoursAgo - 1) * 3600 * 1000) : null,
      },
    });
  }

  // ---------- Content hub ----------
  const authors = [
    { name: "دکتر نیلوفر کریمی", bio: "متخصص فیزیولوژی ورزشی و مربی درجه ۲ فدراسیون", avatarEmoji: "👩‍⚕️", credentialLabel: "دکترای فیزیولوژی ورزش" },
    { name: "سعید موسوی", bio: "مربی بدنسازی با ۱۲ سال سابقه کار با ورزشکاران ملی", avatarEmoji: "🏋️", credentialLabel: "مربی درجه ۱ بدنسازی" },
    { name: "شیما احمدی", bio: "کارشناس تغذیه ورزشی", avatarEmoji: "🥗", credentialLabel: "کارشناسی ارشد تغذیه" },
  ];
  const authorRows: Awaited<ReturnType<typeof db.author.create>>[] = [];
  for (const a of authors) authorRows.push(await db.author.create({ data: a }));

  const categories = [
    { slug: "training", nameFa: "تمرین", description: "برنامه‌ریزی، تکنیک و پیشرفت تمرینی", orderIndex: 1 },
    { slug: "nutrition", nameFa: "تغذیه", description: "تغذیه علمی برای هدف‌های تناسب اندام", orderIndex: 2 },
    { slug: "recovery", nameFa: "ریکاوری", description: "خواب، ریکاوری و مدیریت خستگی", orderIndex: 3 },
    { slug: "science", nameFa: "علم و پژوهش", description: "خلاصه پژوهش‌های معتبر", orderIndex: 4 },
    { slug: "stories", nameFa: "داستان موفقیت", description: "تجربه‌های واقعی کاربران اسی‌فیت", orderIndex: 5 },
  ];
  const catRows: Awaited<ReturnType<typeof db.category.create>>[] = [];
  for (const c of categories) catRows.push(await db.category.create({ data: c }));
  const catBySlug = new Map(catRows.map((c) => [c.slug, c.id]));

  for (const a of ARTICLES) {
    const article = await db.article.create({
      data: {
        slug: a.slug, title: a.title, contentType: a.contentType, status: "published",
        authorId: authorRows[a.authorIdx].id,
        reviewerId: a.reviewerIdx != null ? authorRows[a.reviewerIdx].id : null,
        categoryId: catBySlug.get(a.category)!,
        metaTitle: a.metaTitle, metaDescription: a.metaDescription, excerpt: a.excerpt,
        coverEmoji: a.coverEmoji, readingMinutes: a.readingMinutes,
        contentBlocks: JSON.stringify(a.blocks),
        calculatorSlug: a.calculatorSlug ?? null,
        publishedAt: new Date(Date.now() - a.daysAgo * 86400000),
        updatedAt: new Date(Date.now() - (a.daysAgo - 2) * 86400000),
        revision: 1,
      },
    });
    for (const s of a.sources) {
      await db.articleSource.create({ data: { articleId: article.id, ...s } });
    }
  }

  // ---------- Commerce ----------
  for (const p of PRODUCTS) await db.product.create({ data: p });
  for (const p of SUBSCRIPTION_PLANS) await db.subscriptionPlan.create({ data: p });

  // ---------- Coach, Admin & roster athletes ----------
  // Roles are the permission axis (member | coach | admin); tiers stay monetization-only.
  // Roster athletes get compact 35-day histories with distinct coaching signals:
  //   - consistent progresser, - a plateauing athlete, - a low-adherence athlete.

  const admin = await db.user.create({
    data: { phone: "09140000000", displayName: "مدیر اسی‌فیت", role: "admin", tier: "vip_plus" },
  });
  await db.userProfile.create({
    data: { userId: admin.id, birthYear: 1365, sexAtBirth: "male", heightCm: 180, primaryGoal: "health", experienceLevel: "advanced", activityLevel: "moderate", onboardedAt: isoDaysAgo(200) },
  });

  const coach = await db.user.create({
    data: { phone: "09130000000", displayName: "مربی نیما", role: "coach", tier: "coach" },
  });
  await db.userProfile.create({
    data: { userId: coach.id, birthYear: 1361, sexAtBirth: "male", heightCm: 183, primaryGoal: "build_muscle", experienceLevel: "advanced", activityLevel: "active", weeklyWorkoutTarget: 5, onboardedAt: isoDaysAgo(200) },
  });

  type RosterSpec = {
    phone: string; name: string; tier: string; mode: "progress" | "plateau" | "low_adherence";
    weight: number; daysAgo: number;
  };
  const rosterSpecs: RosterSpec[] = [
    { phone: "09121110001", name: "سارا محمدی", tier: "vip", mode: "progress", weight: 58, daysAgo: 35 },
    { phone: "09121110002", name: "رضا کریمی", tier: "free", mode: "plateau", weight: 84, daysAgo: 35 },
    { phone: "09121110004", name: "علی رضایی", tier: "free", mode: "low_adherence", weight: 91, daysAgo: 35 },
  ];

  const rosterExercises = ["barbell-bench-press", "barbell-squat", "overhead-press", "barbell-row", "leg-press", "lat-pulldown"];
  const baseWeights: Record<string, number> = {
    "barbell-bench-press": 42, "barbell-squat": 65, "overhead-press": 28,
    "barbell-row": 45, "leg-press": 110, "lat-pulldown": 45,
  };

  for (const spec of rosterSpecs) {
    const athlete = await db.user.update({
      where: { phone: spec.phone },
      data: { displayName: spec.name },
    });
    await db.userProfile.upsert({
      where: { userId: athlete.id },
      update: { weeklyWorkoutTarget: 3, onboardedAt: isoDaysAgo(spec.daysAgo) },
      create: { userId: athlete.id, birthYear: 1372, sexAtBirth: spec.name.startsWith("س") ? "female" : "male", heightCm: 172, primaryGoal: "build_muscle", experienceLevel: "beginner", activityLevel: "light", weeklyWorkoutTarget: 3, onboardedAt: isoDaysAgo(spec.daysAgo) },
    });

    // Weekly sessions per adherence mode: progress/plateau 3x/week, low adherence 1x/week with skipped weeks.
    const slots = spec.mode === "low_adherence" ? [1] : [1, 3, 5];
    for (let day = spec.daysAgo; day >= 0; day -= 2) {
      const d = isoDaysAgo(day);
      const weekIdx = Math.floor((spec.daysAgo - day) / 7);
      if (!slots.includes(day % 7)) continue;
      if (spec.mode === "low_adherence" && weekIdx % 2 === 1) continue; // skips entire weeks

      const startedAt = new Date(d);
      startedAt.setUTCHours(18, 30, 0, 0);
      const durationSec = Math.round(between(40, 60) * 60);
      const session = await db.workoutSession.create({
        data: {
          userId: athlete.id, name: pick(["فول‌بادی", "بالاتنه", "پایین‌تنه"]),
          startedAt, endedAt: new Date(startedAt.getTime() + durationSec * 1000),
          durationSeconds: durationSec, status: "completed", syncStatus: "synced",
        },
      });

      let sessionVol = 0;
      for (let i = 0; i < 4; i++) {
        const slug = rosterExercises[i];
        const exerciseId = exBySlug.get(slug);
        if (!exerciseId) continue;
        const log = await db.exerciseLog.create({ data: { sessionId: session.id, exerciseId, orderIndex: i } });

        // progresser climbs weekly; plateau athlete flatlines after week 2; low adherence drifts
        const weeklyGain = spec.mode === "progress" ? 1.2 : spec.mode === "plateau" ? (weekIdx < 2 ? 1.0 : 0) : 0.4;
        const base = baseWeights[slug] + weeklyGain * weekIdx;
        let vol = 0;
        for (let st = 0; st < 3; st++) {
          const w = Math.round(base * between(0.95, 1.04));
          const reps = Math.max(4, Math.round(between(7, 11)));
          vol += w * reps;
          await db.setLog.create({
            data: { exerciseLogId: log.id, setNumber: st + 1, weightKg: w, reps, rpe: pick([7, 7.5, 8]), completedAt: new Date(startedAt.getTime() + (st + 1) * 240000) },
          });
        }
        sessionVol += vol;
      }
      await db.workoutSession.update({ where: { id: session.id }, data: { totalVolumeKg: sessionVol } });
    }

    // PRs for the progresser
    if (spec.mode === "progress") {
      for (const slug of rosterExercises.slice(0, 4)) {
        const exerciseId = exBySlug.get(slug);
        if (!exerciseId) continue;
        const w = baseWeights[slug] + 8;
        await db.personalRecord.create({
          data: { userId: athlete.id, exerciseId, recordType: "weight", value: w, unit: "kg", achievedAt: isoDaysAgo(3), isCurrent: true },
        });
      }
    }

    // one active goal per athlete for the coach view
    const latestWeight = spec.weight + (spec.mode === "progress" ? -1.5 : spec.mode === "plateau" ? 0 : 0.5);
    await db.goal.create({
      data: {
        userId: athlete.id, type: "weight",
        title: spec.mode === "progress" ? "کاهش وزن پایدار" : spec.mode === "plateau" ? "شکستن سکوت قدرت" : "بازگشت به نظم تمرین",
        startValue: spec.weight, targetValue: spec.mode === "progress" ? spec.weight - 4 : spec.mode === "plateau" ? spec.weight : spec.weight - 2,
        unit: "kg", startDate: dateOnly(isoDaysAgo(spec.daysAgo)), targetDate: dateOnly(isoDaysAgo(-55)),
      },
    });

    await db.bodyMeasurement.upsert({
      where: { userId_measuredOn: { userId: athlete.id, measuredOn: dateOnly(isoDaysAgo(1)) } },
      update: { weightKg: latestWeight },
      create: { userId: athlete.id, measuredOn: dateOnly(isoDaysAgo(1)), weightKg: latestWeight },
    });

    await db.coachClient.create({
      data: { coachId: coach.id, athleteId: athlete.id, note: spec.mode === "plateau" ? "دو هفته است وزنه‌ها ثابت مانده — برنامه تغییری نکرده" : "" },
    });
  }

  // coach also tracks the main demo athlete
  await db.coachClient.create({ data: { coachId: coach.id, athleteId: demo.id, note: "برنامه ۴ روزه — رویکرد هیپرتروفی" } });

  // sample weekly recap for the demo user (rules-generated)
  await db.weeklyRecap.create({
    data: {
      userId: demo.id, weekStart: dateOnly(isoDaysAgo(6)), source: "rules",
      contentFa: "هفته‌ای منظم بودی: ۳ جلسه تمرین با مجموع ۹٫۲ تُن حجم، یک رکورد شخصی جدید در پرس سینه، و میانگین آمادگی ۷۸ از ۱۰۰. تغذیه در ۵ روز از ۷ روز ثبت شده است. هفته آینده روی افزایش ۲٫۵ کیلوگرمی اسکوات تمرکز کن.",
      metricsJson: JSON.stringify({ sessions: 3, tonnageKg: 9200, prs: 1, avgReadiness: 78, adherence: 0.75 }),
    },
  });

  console.log("✅ Seed complete");
  console.log(`   Demo user: 09120000000 (امیر رضایی, VIP)`);
  console.log(`   Coach:    09130000000 (مربی نیما) — roster: 4 athletes`);
  console.log(`   Admin:    09140000000 (مدیر اسی‌فیت)`);
  console.log(`   ${trainingDays.length} workout sessions, ${prCount} PRs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
