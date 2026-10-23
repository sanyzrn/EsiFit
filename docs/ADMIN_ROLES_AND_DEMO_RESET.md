# Admin / coach model and demo data reset (2026-10-23)

## Role model
- `admin`: supervisor only, dashboard at `/admin`; manage coach accounts, athlete roles and **one primary coach per athlete** via `/api/admin/coach-assignments`.
- `coach`: see and manage only assigned athletes at `/coach` (the `CoachClient` relationship). The admin cannot become a coach of their own clients.
- `member`: everyday workout, food, water, progress, and onboarding experiences.
- Role and tier are separate: changing a subscription tier **does not** assign a coach.

## Coach assignment flow
At **Admin → مربی‌ها و ورزشکاران**, pick an active coach for each active athlete.
The API validates roles/server authorization and atomically removes previous links
and creates one active `CoachClient` relation. Selecting «بدون مربی» removes the link.
Coach rosters read these links and update after navigation/reload.
The admin can change role/status on the separate Users tab.

## Demo reset contract
Requested on 2026-10-23 for the current 7-user isolated test environment.
Reset targets are the **four users with role='member'**. Keep all seven account
records, all account roles/tiers, both coaches, the administrator, and the global
exercise/food/muscle/badge/mission catalogue data. Discard member-specific
workouts and plans (with dependent sets), nutrition/water/sleep, goals, readiness,
measurements, records, XP, badges, mission progress, exercise swaps, notifications,
weekly reports and personal content. Discard seeded coach-client links so the admin
can explicitly reassign each athlete in the UI.

Reset athlete `UserProfile` fields, including `onboardedAt=NULL`, so login leads to
the full 3-step first-registration setup. Login credentials, sessions, role, tier,
device permissions and coach/admin onboarding remain untouched.
Do not reset global plans/catalogue or real customer accounts in later environments.
Do not ship a public reset API; this one-time operation is executed against the
explicit test project after a transaction-safe scope review.

Offline notes: the client clears stale queued workout/water operations and dashboard
caches on the new onboarding screen, so replay cannot resurrect pre-reset logs.

## Security advisory
2026-10-23: Supabase reports RLS disabled on all 51 tables in `esifit`.
This needs a review of whether the schema is exposed to Supabase Data API and
proper SQL policies before non-test launch. Do not blindly enable RLS: application
Prisma traffic/policies may need separate configuration and production data must
not become inaccessible. The reset does not change grants, RLS or schema.
