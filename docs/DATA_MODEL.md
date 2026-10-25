# Database contract

`prisma/schema.prisma` is the current canonical PostgreSQL model. Earlier frontend mock diagrams do not supersede the implemented domain schema.

## Audit phases 1–3: RateLimitBucket

| Field | Type | Purpose |
|---|---|---|
| key | string, primary key | SHA-256 of operation scope and actor/IP; no raw IP stored |
| count | integer | Accepted requests in the current fixed window |
| resetAt | timestamp, indexed | Window expiry and bounded cleanup |

Counters are shared across application instances. A transaction advisory lock serializes first-use/reset/increment for each key. `docs/migrations/20261025071537_validated_audit_rate_limits.sql` creates the table in the production `esifit` schema with RLS and no client-role grants. The server uses the existing owner connection. No user/fitness tables or histories are rewritten.

`SetLog.isWarmup` already existed; it is now written by offline sync. `needsOnboarding` is an explicit API response field with the existing `isNewUser` compatibility alias; neither introduces a database column.

## Audit phase 4: existing entities, no migration

`UserMissionProgress.periodKey` remains the canonical day/Saturday key. Claim requests can optionally specify a completed historical period; current-period requests remain backwards-compatible. XP source IDs retain `missionId-periodKey`, and claim state, XP and notification commit atomically.

Badge rules use actual persisted activity. Water badges use consecutive days reaching the profile's current water target (historical target changes are not versioned by the existing model). Nutrition badges count consecutive logged days; early workouts use the user's local hour before 08:00. Current activity streak and lifetime badge statistics have no arbitrary 60-day/session cap.

No account history or challenge records are deleted. Competition scoring/settlement remains unavailable; existing data fields do not constitute shipped functionality. `fake-indexeddb` is a pinned development-only dependency for exercising queue durability and failure outcomes, not production storage.
