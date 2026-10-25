-- Release-owner bootstrap: reuse only the single enabled admin-tested connection.
-- Never change an existing policy or select arbitrarily among multiple providers.
INSERT INTO esifit."AiPlanningPolicy" (id,enabled,"providerId","dailyLimit","monthlyLimit","updatedAt")
SELECT 'default',true,id,3,30,now() FROM esifit."AiProvider"
WHERE enabled AND "testedAt" IS NOT NULL
AND (SELECT count(*) FROM esifit."AiProvider" WHERE enabled)=1
ON CONFLICT (id) DO NOTHING;
