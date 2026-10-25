-- Additive Prisma-generated migration; apply once through the migration service.
-- AlterTable
ALTER TABLE esifit."UserProfile" ADD COLUMN     "aiPlanningConsentAt" TIMESTAMP(3),
ADD COLUMN     "healthNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "medicalReviewRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workoutMinutes" INTEGER NOT NULL DEFAULT 45;

-- AlterTable
ALTER TABLE esifit."AiMessage" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE esifit."AiUsageLog" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'chat';

-- CreateTable
CREATE TABLE esifit."AiPlanningPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "providerId" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 3,
    "monthlyLimit" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPlanningPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE esifit."AiPlanRun" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestNote" TEXT NOT NULL DEFAULT '',
    "requestedMode" TEXT NOT NULL DEFAULT 'ai',
    "status" TEXT NOT NULL DEFAULT 'generating',
    "source" TEXT NOT NULL DEFAULT 'ai',
    "baselinePlanId" TEXT,
    "contextHash" TEXT NOT NULL,
    "planJson" TEXT,
    "explanationJson" TEXT NOT NULL DEFAULT '[]',
    "riskJson" TEXT NOT NULL DEFAULT '[]',
    "failureCode" TEXT,
    "providerId" TEXT,
    "appliedPlanId" TEXT,
    "usageRequestId" TEXT,
    "reviewRequestedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPlanRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiPlanningPolicy_providerId_idx" ON esifit."AiPlanningPolicy"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "AiPlanRun_requestKey_key" ON esifit."AiPlanRun"("requestKey");

-- CreateIndex
CREATE INDEX "AiPlanRun_athleteId_createdAt_idx" ON esifit."AiPlanRun"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "AiPlanRun_actorId_status_createdAt_idx" ON esifit."AiPlanRun"("actorId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiMessage_requestId_role_key" ON esifit."AiMessage"("requestId", "role");

-- AddForeignKey
ALTER TABLE esifit."AiPlanningPolicy" ADD CONSTRAINT "AiPlanningPolicy_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES esifit."AiProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE esifit."AiPlanRun" ADD CONSTRAINT "AiPlanRun_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES esifit."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE esifit."AiPlanRun" ADD CONSTRAINT "AiPlanRun_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES esifit."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE esifit."AiPlanningPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE esifit."AiPlanRun" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE esifit."AiPlanningPolicy", esifit."AiPlanRun" FROM anon, authenticated;
