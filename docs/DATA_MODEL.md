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

## Audit phase 5: commerce receipts and privacy, no migration

- `GET /api/store/orders`: member-only, session owner scoping, 20-row pages ordered by `(createdAt DESC, id DESC)`, opaque URL-encoded `timestamp!id` cursor. Responses are private/no-store.
- Shared receipts contain `id`, `status`, ISO `createdAt`, `currency: IRT`, original `totalToman`, `discountToman` and parsed `itemsJson`. New snapshots also record discounted `unitPriceToman` and `lineTotalToman`; legacy base prices and authoritative totals remain valid. Product edits do not rewrite receipts. Invalid legacy item JSON yields an empty detail list while preserving totals.
- Subscription POST and DELETE serialize on the existing User row. Cancellation immediately marks active rows canceled and returns the member to free; retries produce no extra cancellation notification. Accounts without a purchased active subscription preserve their manually assigned tier. Lazy expiry rechecks under the same lock before any downgrade, preventing stale expiry reads from overwriting a new purchase.
- Checkout and subscription purchases each use the existing shared PostgreSQL limiter: 10 validated member attempts per hour. Production still denies mock purchases unless explicitly enabled.
- Member exports retain `esifit-export-v1` and fitness history, adding owned receipts, subscriptions and selected account preferences. They exclude session tokens and credentials. Free members can export; staff remain outside the member API. This is not a comprehensive account-domain export or a claim of legal compliance.
- `/api/auth/me` intentionally returns HTTP 200 with `user: null` for anonymous/revoked sessions.
- Account erasure, real payment/refund/recurring billing and MRR remain unimplemented. No production data is migrated or deleted.
