-- EsiFit additive migration: virtual AI coach enrollment (2026-10-23)
-- Applied only to the existing `esifit` Postgres schema.
-- Does not modify, delete, or repurpose human accounts/assignments.
CREATE TABLE IF NOT EXISTS esifit."AiCoachEnrollment" (
  "id" TEXT PRIMARY KEY,
  "athleteId" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiCoachEnrollment_athleteId_fkey"
    FOREIGN KEY ("athleteId") REFERENCES esifit."User"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "AiCoachEnrollment_status_check"
    CHECK ("status" IN ('reserved', 'enabled', 'disabled'))
);

-- No client-facing Supabase Data API access, even if the schema is exposed.
ALTER TABLE esifit."AiCoachEnrollment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE esifit."AiCoachEnrollment" FROM PUBLIC;
REVOKE ALL ON TABLE esifit."AiCoachEnrollment" FROM anon, authenticated;

-- AI remains reserved only. Never auto-activate by assigning a member.
