# EsiFit authorization design — Phase 1 (2026-10-23)

## Core axes (distinct — never grant business permissions from a paid tier)

1. **Role (RBAC):** exactly one of `admin`, `coach`, `member` per account.
2. **Relationship (ReBAC):** `CoachClient` assigns one primary coach to an athlete via admin-controlled enrollment. Coach scopes use this active relation and validate athlete ownership on every request.
3. **Subscription (entitlements):** applies **only to role=member**; tiers `free`, `vip`, `vip_plus` unlock *consumer features*, never staff permissions. Expiry handled by server-side active subscription resolution.
4. **Fitness skill level:** beginner/intermediate/advanced on `UserProfile`, independent of role and subscription.

This follows [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
least privilege, deny by default, server-side every-request checks and relationship-based resource checks.
Billing features vs roles follow [Stripe entitlements principles](https://docs.stripe.com/billing/entitlements).

## Explicit permission matrix

| Operation | Member | Coach | Admin |
| --- | --- | --- | --- |
| Own workouts/sets, diet/water, body data, goals, analytics | Yes | No | No |
| Own member AI quota, VIP features, store checkout, upgrades | Based on tier | No | No |
| Member community posting, likes, comments | Yes | No | No |
| View own assigned athletes | No | Yes | Admin can inspect for oversight |
| Assign plans to athletes | No | Assigned active coach only | No (supervision, not coaching) |
| Assign/reassign coach ↔ member | No | No | Yes |
| Manage user role and tier | No | No | Yes, excluding protected admin accounts |
| Moderate community or system administration | No | No | Yes |
| Own account settings, sessions, notifications | Yes | Yes | Yes |

Admin has NO automatic coach or member powers. `coach_or_admin` is permitted only on
supervisory **read** routes such as reviewing athlete detail. Mutations are role-specific.
Coaches can access only **active**, explicitly linked member accounts.
Admin does not need to be inserted into normal users lists, including API results.

## Role transition invariants

- Users management cannot promote to Admin or alter admin accounts. Staff provisioning needs a dedicated, separately audited workflow.
- Member → Coach: removes their active athlete-to-coach relationship; neutralizes stored tier to `free`. Historical data is not deleted.
- Coach → Member: blocked until *all* athletes have been reassigned/unlinked; no silent orphaned rosters.
- A user with an active paid subscription cannot change role or be manually retiered until their subscription is properly handled. No silent cancellation or billing data deletion.
- Active staff roles are never eligible for consumer subscription purchases, even if a legacy tier says `vip_plus` or `coach`.
- Role/roster changes occur transactionally. Account sessions re-check role from DB; suspended sessions are revoked.
- Admin user selections contain only member/coach roles; subscription selector is rendered only for member rows.

## Transitional database compatibility

`User.tier` is currently a NOT NULL string. For admin/coach, store technical
`free` as a **neutral placeholder**, never show it as a staff subscription or unlock
member features. A future nullable-column migration may remove this placeholder after
reviewing billing/subscription records. No destructive schema migration in Phase 1.

Existing legacy staff rows (e.g. `role=coach, tier=coach`) are safe: the session
layer derives member benefits **only if role=member**. Normalize known test accounts
to the neutral placeholder after production deployment and authorization tests.

Member API endpoints use `requireMember`, not only `requireUser`.
Role checks are authoritative at the server, independent of hidden client navigation.

## Remaining work / scope limits

- Phase 2: visual administration redesign and separate coach/member management layouts.
- Phase 3: broad staff account settings UX; Phase 1 already suppresses member fitness controls in staff settings to prevent misleading options.
- No RLS activation, grants or Supabase policies changed. Security review before public release remains mandatory.
- No production payment gateway enabled. Trial subscription plans are mock only and must remain behind production feature flags.
- If adding future *dual role* requirements (e.g. coach exercising as member), use a **separate athlete profile/context switching design**, not a VIP tier that magically grants coaching authority.
