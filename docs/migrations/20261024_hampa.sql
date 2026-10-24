-- CreateTable
CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "testedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGrant" (
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyLimit" INTEGER NOT NULL DEFAULT 20,
    "monthlyLimit" INTEGER NOT NULL DEFAULT 300,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiGrant_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AiAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "requestId" TEXT NOT NULL DEFAULT '',
    "conversationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resultJson" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAction_actorId_conversationId_createdAt_idx" ON "AiAction"("actorId", "conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiGrant" ADD CONSTRAINT "AiGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGrant" ADD CONSTRAINT "AiGrant_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only the server's Prisma database role can reach these tables.
ALTER TABLE "AiProvider" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiAction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AiProvider", "AiGrant", "AiAction" FROM PUBLIC;
-- Supabase client roles exist in production, but not in disposable CI Postgres.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "AiProvider", "AiGrant", "AiAction" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "AiProvider", "AiGrant", "AiAction" FROM authenticated;
  END IF;
END $$;

ALTER TABLE "AiProvider" ADD CONSTRAINT "AiProvider_kind_check" CHECK ("kind" IN ('gemini', 'custom'));
ALTER TABLE "AiGrant" ADD CONSTRAINT "AiGrant_limits_check" CHECK ("dailyLimit" BETWEEN 0 AND 1000 AND "monthlyLimit" BETWEEN 0 AND 30000);
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_status_check" CHECK ("status" IN ('pending','executing','succeeded','failed','cancelled'));
