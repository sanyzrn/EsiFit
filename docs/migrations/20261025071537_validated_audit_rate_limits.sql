-- Additive deployment prerequisite. EsiFit production uses the esifit schema.
-- Run with the application's server/database-owner role before deploying code.
BEGIN;
CREATE TABLE IF NOT EXISTS esifit."RateLimitBucket" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON esifit."RateLimitBucket"("resetAt");
ALTER TABLE esifit."RateLimitBucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE esifit."RateLimitBucket" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE esifit."RateLimitBucket" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE esifit."RateLimitBucket" FROM authenticated;
  END IF;
END $$;
COMMIT;
