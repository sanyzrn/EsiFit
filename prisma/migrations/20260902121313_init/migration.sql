-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'member',
    `tier` VARCHAR(191) NOT NULL DEFAULT 'free',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Tehran',
    `locale` VARCHAR(191) NOT NULL DEFAULT 'fa',
    `unitSystem` VARCHAR(191) NOT NULL DEFAULT 'metric',
    `theme` VARCHAR(191) NOT NULL DEFAULT 'dark',
    `reducedMotion` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `birthYear` INTEGER NULL,
    `sexAtBirth` VARCHAR(191) NULL,
    `heightCm` DOUBLE NULL,
    `primaryGoal` VARCHAR(191) NULL,
    `experienceLevel` VARCHAR(191) NULL,
    `activityLevel` VARCHAR(191) NULL,
    `dailyCalorieTarget` DOUBLE NULL,
    `dailyProteinTarget` DOUBLE NULL,
    `dailyCarbTarget` DOUBLE NULL,
    `dailyFatTarget` DOUBLE NULL,
    `dailyWaterTargetMl` INTEGER NOT NULL DEFAULT 2500,
    `weeklyWorkoutTarget` INTEGER NOT NULL DEFAULT 4,
    `onboardedAt` DATETIME(3) NULL,

    UNIQUE INDEX `UserProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpCode` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL DEFAULT 'login',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpCode_phone_createdAt_idx`(`phone`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpRequestLog` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpRequestLog_phone_createdAt_idx`(`phone`, `createdAt`),
    INDEX `OtpRequestLog_ip_createdAt_idx`(`ip`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `deviceLabel` VARCHAR(191) NOT NULL DEFAULT 'دستگاه ناشناس',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BodyMeasurement` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `measuredOn` VARCHAR(191) NOT NULL,
    `weightKg` DOUBLE NULL,
    `bodyFatPct` DOUBLE NULL,
    `waistCm` DOUBLE NULL,
    `chestCm` DOUBLE NULL,
    `hipCm` DOUBLE NULL,
    `armCm` DOUBLE NULL,
    `thighCm` DOUBLE NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BodyMeasurement_userId_measuredOn_idx`(`userId`, `measuredOn`),
    UNIQUE INDEX `BodyMeasurement_userId_measuredOn_key`(`userId`, `measuredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Goal` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT '',
    `startValue` DOUBLE NOT NULL,
    `targetValue` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `metaJson` TEXT NOT NULL DEFAULT '{}',
    `startDate` VARCHAR(191) NOT NULL,
    `targetDate` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Goal_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReadinessDaily` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scoreDate` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `calculationVersion` VARCHAR(191) NOT NULL DEFAULT 'v1',
    `isEstimated` BOOLEAN NOT NULL DEFAULT true,
    `factorsJson` LONGTEXT NOT NULL DEFAULT '[]',

    INDEX `ReadinessDaily_userId_scoreDate_idx`(`userId`, `scoreDate`),
    UNIQUE INDEX `ReadinessDaily_userId_scoreDate_key`(`userId`, `scoreDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MuscleGroup` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `MuscleGroup_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exercise` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `equipment` VARCHAR(191) NOT NULL,
    `movementPattern` VARCHAR(191) NOT NULL,
    `difficulty` VARCHAR(191) NOT NULL DEFAULT 'intermediate',
    `isUnilateral` BOOLEAN NOT NULL DEFAULT false,
    `instructionsFa` TEXT NOT NULL DEFAULT '',
    `cuesJson` LONGTEXT NOT NULL DEFAULT '[]',
    `isCompound` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Exercise_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExerciseMuscle` (
    `exerciseId` VARCHAR(191) NOT NULL,
    `muscleGroupId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `intensity` DOUBLE NOT NULL DEFAULT 0.5,

    PRIMARY KEY (`exerciseId`, `muscleGroupId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutPlan` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `goalType` VARCHAR(191) NOT NULL DEFAULT 'build_muscle',
    `weeks` INTEGER NOT NULL DEFAULT 4,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `startsOn` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkoutPlan_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutPlanDay` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `weekNumber` INTEGER NOT NULL,
    `dayNumber` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `focusRegion` VARCHAR(191) NOT NULL DEFAULT '',
    `isRestDay` BOOLEAN NOT NULL DEFAULT false,

    INDEX `WorkoutPlanDay_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlannedExercise` (
    `id` VARCHAR(191) NOT NULL,
    `planDayId` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `targetSets` INTEGER NOT NULL DEFAULT 3,
    `targetRepsMin` INTEGER NOT NULL DEFAULT 8,
    `targetRepsMax` INTEGER NOT NULL DEFAULT 12,
    `targetRpe` DOUBLE NOT NULL DEFAULT 7.5,
    `restSeconds` INTEGER NOT NULL DEFAULT 90,
    `note` TEXT NOT NULL DEFAULT '',

    INDEX `PlannedExercise_planDayId_idx`(`planDayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planDayId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'تمرین آزاد',
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `durationSeconds` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `syncStatus` VARCHAR(191) NOT NULL DEFAULT 'synced',
    `note` TEXT NOT NULL DEFAULT '',
    `clientId` VARCHAR(191) NULL,
    `totalVolumeKg` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WorkoutSession_clientId_key`(`clientId`),
    INDEX `WorkoutSession_userId_startedAt_idx`(`userId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExerciseLog` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `note` TEXT NOT NULL DEFAULT '',

    INDEX `ExerciseLog_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SetLog` (
    `id` VARCHAR(191) NOT NULL,
    `exerciseLogId` VARCHAR(191) NOT NULL,
    `setNumber` INTEGER NOT NULL,
    `weightKg` DOUBLE NULL,
    `reps` INTEGER NULL,
    `rpe` DOUBLE NULL,
    `durationSeconds` INTEGER NULL,
    `distanceM` DOUBLE NULL,
    `isWarmup` BOOLEAN NOT NULL DEFAULT false,
    `isPr` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `clientId` VARCHAR(191) NULL,

    UNIQUE INDEX `SetLog_clientId_key`(`clientId`),
    INDEX `SetLog_exerciseLogId_idx`(`exerciseLogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Food` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `servingAmount` DOUBLE NOT NULL DEFAULT 100,
    `servingUnit` VARCHAR(191) NOT NULL DEFAULT 'گرم',
    `calories` DOUBLE NOT NULL,
    `proteinG` DOUBLE NOT NULL,
    `carbsG` DOUBLE NOT NULL,
    `fatG` DOUBLE NOT NULL,
    `fiberG` DOUBLE NOT NULL DEFAULT 0,
    `sodiumMg` DOUBLE NOT NULL DEFAULT 0,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Food_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NutritionDay` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `logDate` VARCHAR(191) NOT NULL,

    INDEX `NutritionDay_userId_logDate_idx`(`userId`, `logDate`),
    UNIQUE INDEX `NutritionDay_userId_logDate_key`(`userId`, `logDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealEntry` (
    `id` VARCHAR(191) NOT NULL,
    `nutritionDayId` VARCHAR(191) NOT NULL,
    `foodId` VARCHAR(191) NOT NULL,
    `mealSlot` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL DEFAULT 1,
    `servingMultiplier` DOUBLE NOT NULL DEFAULT 1,
    `clientId` VARCHAR(191) NULL,

    UNIQUE INDEX `MealEntry_clientId_key`(`clientId`),
    INDEX `MealEntry_nutritionDayId_idx`(`nutritionDayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NutritionTarget` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `effectiveFrom` VARCHAR(191) NOT NULL,
    `effectiveTo` VARCHAR(191) NULL,
    `calories` DOUBLE NOT NULL,
    `proteinG` DOUBLE NOT NULL,
    `carbsG` DOUBLE NOT NULL,
    `fatG` DOUBLE NOT NULL,
    `fiberG` DOUBLE NOT NULL DEFAULT 25,

    INDEX `NutritionTarget_userId_effectiveFrom_idx`(`userId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaterLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `ml` INTEGER NOT NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `logDate` VARCHAR(191) NOT NULL,
    `syncStatus` VARCHAR(191) NOT NULL DEFAULT 'synced',
    `clientId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `WaterLog_clientId_key`(`clientId`),
    INDEX `WaterLog_userId_logDate_idx`(`userId`, `logDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SleepLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sleepStart` DATETIME(3) NOT NULL,
    `sleepEnd` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `qualityScore` INTEGER NOT NULL DEFAULT 70,
    `restingHrBpm` DOUBLE NULL,
    `hrvMs` DOUBLE NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `logDate` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `SleepLog_userId_logDate_key`(`userId`, `logDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalculatorResult` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `calculatorType` VARCHAR(191) NOT NULL,
    `calculatorVersion` VARCHAR(191) NOT NULL DEFAULT 'v1',
    `inputsJson` LONGTEXT NOT NULL,
    `resultJson` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CalculatorResult_userId_calculatorType_createdAt_idx`(`userId`, `calculatorType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Badge` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `descriptionFa` TEXT NOT NULL,
    `icon` VARCHAR(191) NOT NULL DEFAULT 'award',
    `criteriaType` VARCHAR(191) NOT NULL,
    `criteriaValue` INTEGER NOT NULL DEFAULT 1,
    `tier` VARCHAR(191) NOT NULL DEFAULT 'bronze',

    UNIQUE INDEX `Badge_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBadge` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `earnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserBadge_userId_badgeId_key`(`userId`, `badgeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mission` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `descriptionFa` TEXT NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `criteriaType` VARCHAR(191) NOT NULL,
    `target` INTEGER NOT NULL,
    `xpReward` INTEGER NOT NULL DEFAULT 50,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Mission_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserMissionProgress` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `missionId` VARCHAR(191) NOT NULL,
    `periodKey` VARCHAR(191) NOT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `target` INTEGER NOT NULL,
    `claimed` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `UserMissionProgress_userId_missionId_periodKey_key`(`userId`, `missionId`, `periodKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `XpLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `XpLog_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `XpLog_userId_sourceType_sourceId_key`(`userId`, `sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Challenge` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `metric` VARCHAR(191) NOT NULL,
    `targetValue` DOUBLE NOT NULL DEFAULT 0,
    `startDate` VARCHAR(191) NOT NULL,
    `endDate` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    `inviteCode` VARCHAR(191) NULL,
    `ownerUserId` VARCHAR(191) NULL,
    `badgeSlug` VARCHAR(191) NULL DEFAULT '',
    `emoji` VARCHAR(191) NOT NULL DEFAULT '🏆',

    UNIQUE INDEX `Challenge_slug_key`(`slug`),
    UNIQUE INDEX `Challenge_inviteCode_key`(`inviteCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChallengeParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `challengeId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChallengeParticipant_challengeId_userId_key`(`challengeId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `imageUrl` TEXT NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'public',
    `workoutType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Post_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Comment_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostLike` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PostLike_postId_userId_key`(`postId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `actionUrl` TEXT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Author` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `bio` TEXT NOT NULL DEFAULT '',
    `avatarEmoji` VARCHAR(191) NOT NULL DEFAULT '🧑‍⚕️',
    `credentialLabel` VARCHAR(191) NOT NULL DEFAULT '',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `orderIndex` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Article` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'published',
    `authorId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `metaTitle` VARCHAR(191) NOT NULL DEFAULT '',
    `metaDescription` TEXT NOT NULL DEFAULT '',
    `excerpt` TEXT NOT NULL DEFAULT '',
    `coverEmoji` VARCHAR(191) NOT NULL DEFAULT '💪',
    `readingMinutes` INTEGER NOT NULL DEFAULT 5,
    `contentBlocks` LONGTEXT NOT NULL DEFAULT '[]',
    `calculatorSlug` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `revisionNote` TEXT NOT NULL DEFAULT '',

    UNIQUE INDEX `Article_slug_key`(`slug`),
    INDEX `Article_categoryId_status_idx`(`categoryId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArticleSource` (
    `id` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL,
    `publisher` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL DEFAULT 'research',
    `url` TEXT NOT NULL DEFAULT '',
    `doi` VARCHAR(191) NULL DEFAULT '',
    `publishedOn` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `type` VARCHAR(191) NOT NULL DEFAULT 'physical',
    `priceToman` INTEGER NOT NULL,
    `compareAtToman` INTEGER NULL,
    `emoji` VARCHAR(191) NOT NULL DEFAULT '📦',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `stock` INTEGER NOT NULL DEFAULT 50,
    `badge` VARCHAR(191) NULL DEFAULT '',

    UNIQUE INDEX `Product_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionPlan` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `tier` VARCHAR(191) NOT NULL,
    `nameFa` VARCHAR(191) NOT NULL,
    `billingPeriod` VARCHAR(191) NOT NULL,
    `priceToman` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRT',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `featuresFa` TEXT NOT NULL DEFAULT '[]',
    `highlight` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `SubscriptionPlan_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planCode` VARCHAR(191) NOT NULL,
    `tier` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentPeriodEndsAt` DATETIME(3) NOT NULL,
    `canceledAt` DATETIME(3) NULL,

    INDEX `Subscription_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'paid',
    `totalToman` INTEGER NOT NULL,
    `discountToman` INTEGER NOT NULL DEFAULT 0,
    `itemsJson` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Order_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiConversation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'گفتگوی جدید',
    `contextType` VARCHAR(191) NOT NULL DEFAULT 'general',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiConversation_userId_updatedAt_idx`(`userId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiMessage` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'complete',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiUsageLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'z-ai',
    `model` VARCHAR(191) NOT NULL DEFAULT 'glm-4-flash',
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `totalTokens` INTEGER NOT NULL DEFAULT 0,
    `latencyMs` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'success',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiUsageLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PersonalRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `recordType` VARCHAR(191) NOT NULL DEFAULT 'weight',
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'kg',
    `workoutSessionId` VARCHAR(191) NULL,
    `achievedAt` DATETIME(3) NOT NULL,
    `isCurrent` BOOLEAN NOT NULL DEFAULT true,

    INDEX `PersonalRecord_userId_isCurrent_idx`(`userId`, `isCurrent`),
    UNIQUE INDEX `PersonalRecord_userId_exerciseId_recordType_isCurrent_key`(`userId`, `exerciseId`, `recordType`, `isCurrent`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PainReport` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reportedOn` VARCHAR(191) NOT NULL,
    `bodyRegion` VARCHAR(191) NOT NULL,
    `side` VARCHAR(191) NOT NULL DEFAULT 'unknown',
    `severity` INTEGER NOT NULL DEFAULT 3,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `note` TEXT NOT NULL DEFAULT '',

    INDEX `PainReport_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExerciseSwap` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sourceExerciseId` VARCHAR(191) NOT NULL,
    `replacementExerciseId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `workoutSessionId` VARCHAR(191) NULL,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoachClient` (
    `id` VARCHAR(191) NOT NULL,
    `coachId` VARCHAR(191) NOT NULL,
    `athleteId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NOT NULL DEFAULT '',

    INDEX `CoachClient_athleteId_idx`(`athleteId`),
    UNIQUE INDEX `CoachClient_coachId_athleteId_key`(`coachId`, `athleteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyRecap` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `weekStart` VARCHAR(191) NOT NULL,
    `metricsJson` LONGTEXT NOT NULL DEFAULT '{}',
    `contentFa` LONGTEXT NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'rules',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeeklyRecap_userId_weekStart_idx`(`userId`, `weekStart`),
    UNIQUE INDEX `WeeklyRecap_userId_weekStart_key`(`userId`, `weekStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BodyMeasurement` ADD CONSTRAINT `BodyMeasurement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goal` ADD CONSTRAINT `Goal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReadinessDaily` ADD CONSTRAINT `ReadinessDaily_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseMuscle` ADD CONSTRAINT `ExerciseMuscle_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseMuscle` ADD CONSTRAINT `ExerciseMuscle_muscleGroupId_fkey` FOREIGN KEY (`muscleGroupId`) REFERENCES `MuscleGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutPlan` ADD CONSTRAINT `WorkoutPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutPlanDay` ADD CONSTRAINT `WorkoutPlanDay_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `WorkoutPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlannedExercise` ADD CONSTRAINT `PlannedExercise_planDayId_fkey` FOREIGN KEY (`planDayId`) REFERENCES `WorkoutPlanDay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlannedExercise` ADD CONSTRAINT `PlannedExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutSession` ADD CONSTRAINT `WorkoutSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutSession` ADD CONSTRAINT `WorkoutSession_planDayId_fkey` FOREIGN KEY (`planDayId`) REFERENCES `WorkoutPlanDay`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseLog` ADD CONSTRAINT `ExerciseLog_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `WorkoutSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseLog` ADD CONSTRAINT `ExerciseLog_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SetLog` ADD CONSTRAINT `SetLog_exerciseLogId_fkey` FOREIGN KEY (`exerciseLogId`) REFERENCES `ExerciseLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionDay` ADD CONSTRAINT `NutritionDay_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealEntry` ADD CONSTRAINT `MealEntry_nutritionDayId_fkey` FOREIGN KEY (`nutritionDayId`) REFERENCES `NutritionDay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealEntry` ADD CONSTRAINT `MealEntry_foodId_fkey` FOREIGN KEY (`foodId`) REFERENCES `Food`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionTarget` ADD CONSTRAINT `NutritionTarget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaterLog` ADD CONSTRAINT `WaterLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SleepLog` ADD CONSTRAINT `SleepLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalculatorResult` ADD CONSTRAINT `CalculatorResult_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserMissionProgress` ADD CONSTRAINT `UserMissionProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserMissionProgress` ADD CONSTRAINT `UserMissionProgress_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `XpLog` ADD CONSTRAINT `XpLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChallengeParticipant` ADD CONSTRAINT `ChallengeParticipant_challengeId_fkey` FOREIGN KEY (`challengeId`) REFERENCES `Challenge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChallengeParticipant` ADD CONSTRAINT `ChallengeParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostLike` ADD CONSTRAINT `PostLike_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostLike` ADD CONSTRAINT `PostLike_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `Author`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleSource` ADD CONSTRAINT `ArticleSource_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiConversation` ADD CONSTRAINT `AiConversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiMessage` ADD CONSTRAINT `AiMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `AiConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiUsageLog` ADD CONSTRAINT `AiUsageLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalRecord` ADD CONSTRAINT `PersonalRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalRecord` ADD CONSTRAINT `PersonalRecord_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PainReport` ADD CONSTRAINT `PainReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExerciseSwap` ADD CONSTRAINT `ExerciseSwap_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoachClient` ADD CONSTRAINT `CoachClient_coachId_fkey` FOREIGN KEY (`coachId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoachClient` ADD CONSTRAINT `CoachClient_athleteId_fkey` FOREIGN KEY (`athleteId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyRecap` ADD CONSTRAINT `WeeklyRecap_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
