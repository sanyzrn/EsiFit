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
