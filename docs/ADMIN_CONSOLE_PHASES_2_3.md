# EsiFit — Admin UX phase 2 + staff isolation phase 3 (2026-10-23)

## Admin desktop and mobile
- `/admin` is a **management-only workspace**, not a fitness dashboard.
- Mobile-first two-column navigation for: Overview; Coaches & Athletes; Users; Moderation. Full tab labels stay legible on narrow viewports. In desktop, four tabs share one row.
- Overview offers four decision-oriented KPIs, a coach-assignment CTA, recent member/coach activity, and site moderation. It does **not** create or display the admin's workout/water/nutrition data.
- Coach assignment panel has search, status filters, concise roster rows, 1-click select with persisted server response, loading/empty/error states, and 44px controls. User management has explicit field labels; admin accounts are excluded in API and UI. All visual values come from existing surface/text/primary tokens; no new bespoke shadows or gradients.
- Member tier statistics are scoped to `role=member`.

## Staff separation
- **Admin** only supervises users, assigned coaches, content, notifications, and account/security settings. No athlete input screens or member-only workout APIs.
- **Coach** works on assigned active roster only; does not receive athlete workout tracking or VIP entitlement capabilities.
- Staff account settings are account + security + devices + sign out: *no* gym equipment, exercise pain constraints, athlete unit preferences, fitness exports or self-training dialogs.
- The app shell does not launch member offline workout/water synchronization in staff accounts.
- A final API gap for joining workout challenges now rejects `admin` and `coach`; staff can still view public calculators or articles anonymously, but not save athlete results.
- Phase 1 permission matrix remains authoritative: `docs/ACCESS_CONTROL_MODEL.md`. Remaining full RLS audit is outside these phases.

## Virtual AI coach — reserved infrastructure, not a runnable coach
- Do **not** create a fake OTP-capable `User` for AI; it must never appear as a human coach account in login or coach rosters.
- The **synthetic identifier** is `ai:esifit` in the roster options; no passwords, login, authorizations or real staff identity exist for it.
- Database model `AiCoachEnrollment` (unique `athleteId`) stores a reservation with `status=reserved`. The normal `CoachClient` table continues to store genuine human assignments, unmodified.
- On selecting AI in `/admin`, the admin API atomically removes human assignment and creates/updates the reserved AI enrollment. On selecting human/unassigned, it deletes the AI enrollment and manages the existing human relationship.
- Switching assignments NEVER deletes athlete workout history or changes membership.
- AI assignment alone grants **no rights** to read sensitive athlete data, provide exercise prescriptions, auto-generate plans, medical advice, or spend tokens. A later separate phase must add athlete consent, scope-controlled data access, provider selection/quotas, safety checks, human handoff, audit logs, disclosures, and explicit rollout flag. Do not imply that the AI trainer is operational.
- New table is created using the additive SQL migration `docs/sql/ai_coach_enrollment.sql` and its matching `prisma/schema.prisma` model. Its database grants are revoked from client-facing roles and its RLS is enabled. Prisma server connection performs restricted operations.

## Tests and release
- API tests verify admin-only AI assignment, selected coach, invalid role, changes between human/AI/unassigned, and *preserved* workout plans, alongside staff-denied challenge participation.
- No prior athlete records or human roles are reset in this release.
- Build from GitHub Actions validates on an isolated Postgres test schema.
- Vercel's Hobby build rate limit may postpone production deployment; merging to GitHub never implies the production URL is updated. Verify a READY production deployment tied to the exact merge SHA before announcing publication.
