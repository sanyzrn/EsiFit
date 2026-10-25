# Independent validation of audit phases 1–3

Reviewed against main `93c405ff3699e50a0f7a0c2fd72967dbf272b5d5` before implementation (2026-10-25).
This is a validation of the three supplied working notes, not the unfinished seven-part audit.
The previous agent's reported runtime results are not treated as independently reproduced.

| Finding | Independent verdict and code evidence | Decision |
|---|---|---|
| F1 | Confirmed: coach/data.ts resolves any active role in getCoachAthleteDetail | Restrict shared reader to member targets |
| F2 | Confirmed with correction: http/rate-limit.ts uses process memory; limits vary across instances, rather than always becoming immediately ineffective | Shared atomic database counters |
| F3 | Partially unsupported: Vercel documents x-real-ip as identical to its overwritten x-forwarded-for. The claimed Vercel exploit is not established. cf-connecting-ip fallback and arbitrary self-host proxy trust still deserve correction | Centralize IP resolution with an explicit trusted-proxy contract |
| F4 | Confirmed: nutrition/foods has neither isPublic filter nor limiter. Public access itself is intentional | Preserve public search; filter and throttle |
| F5 | Confirmed: moderation DELETE grants coaches powers denied by ACCESS_CONTROL_MODEL | Enforce admin-only moderation |
| F6 | Confirmed: athlete page ignores link.status | Require active link |
| F7 | Partial: no application CSP/HSTS, but upstream HSTS was not inspected. Absence is a hardening gap, not evidence of exploitable XSS | Compatible baseline CSP and production HSTS; document inline-script limitation |
| F8 | Confirmed: two operational settings absent from .env.example | Document encryption and mock-payment settings |
| F9 | Confirmed code portability issue: Node resolver hook does not govern Bun's ESM imports; swallowed seed failure | Bun-supported script-only marker shim; propagate failures |
| F10 | Configuration-dependent risk, not a demonstrated production auth bypass; local dev OTP is intentional | Document production-only public deployments; preserve requested demo flow |
| F11 | Confirmed query/write pattern; expiration write happens once after successful downgrade, not on every subsequent request | No behavior change; retain authoritative entitlement resolution |
| F12 | Regex omission confirmed; claim that all listed prefixes are valid SMS-capable mobiles lacks authoritative evidence | Do not expand acceptance from an unverified telecom claim |
| F13 | Confirmed public subscription badge; product/privacy choice, not an authorization bypass | No automatic product change |
| F14 | Not a defect: report explicitly identifies a tool-output false positive | No change |
| F15 | Confirmed: complete unconditionally awards 70 XP and completes zero-set workouts | Require real non-warmup repetitions or timed work; preserve bodyweight/single-set workouts |
| F16 | Confirmed: inclusive UTC midnight at weekEnd excludes most of the final local day | Local-day inclusive start/exclusive end throughout analytics |
| F17 | Confirmed: isWarmup is read but missing from sync input and live capture | Explicit warmup flag from capture through offline sync; no guessed classification by load |
| F18 | Confirmed: daily-sets and weekly-protein have no progress writers. Weekly claim also incorrectly uses today's key | Derive progress from persisted sets/meals; use Saturday week keys in display and claims |
| F19 | Confirmed: PATCH cannot recompute achieved state or validate future target dates. Already-met upward targets can be created | Validate new targets; recompute edited targets without overriding archive |
| F20 | Confirmed: regex accepts nonexistent dates | Shared strict calendar-date validator at affected API boundaries |
| F21 | Confirmed: sync keys by order as well as exercise; swap ignores planned targets | Reuse canonical exercise log under session lock; check planned targets; preserve recorded sets |
| F22 | Confirmed missing duplicate-goal guard | Reject same active type/scope/target, serialized per user |
| F23 | Intentional self-report; plausibility caps are not independent fitness verification | No claim of complete anti-cheat |
| F24 | Confirmed last-week clamp; automatic periodization is a product/coaching decision, not safe to invent | Record as deferred product work; no automatic program replacement |
| F25 | Confirmed radar ignores warmup unlike strength series | Exclude warmups consistently |
| F26 | Confirmed no timezone editing API; Iran-first product decision | No automatic settings feature |
| F27 | Confirmed arbitrary valid meal dates; historical entry is legitimate, future diary entries can inflate progress | Reject future actual meals; retain historical logging |
| F28 | Confirmed missing goal rewards; additional feature, not broken existing reward logic | Deferred product work |
| F29 | Confirmed unbounded future sessions and negative week bucket | Bound coach reads and use athlete-local calendar buckets |
| F30 | Confirmed no rate limit on coach assignment | Shared per-athlete daily cap, no deletion of archived plans/history |
| F31 | Confirmed zero quota conflated with disabled grant | Distinct zero-quota explanation |
| F32 | Confirmed field means onboarding required; auth-card relies on that meaning | Add explicit needsOnboarding, preserve isNewUser alias for compatibility |

Primary reference for F3: https://vercel.com/docs/headers/request-headers (x-forwarded-for, x-vercel-forwarded-for, x-real-ip).

## Validation boundary

Positive security claims in the supplied notes describe valuable existing controls, but do not constitute a new penetration test or independent confirmation of every prior test. No live SMS/LLM service, production database or deployed-site penetration test was exercised in this local regression workflow. Test outcomes and remaining deployment prerequisites are recorded after implementation below.

## Implemented and independently checked

- Authorization: member-only athlete reader, active relationship page guard, admin-only moderation.
- Shared PostgreSQL counters replace process-local limits; coach assignment is capped per athlete; food search stays public with a public-only filter and IP quota. Vercel proxy trust follows its actual header contract.
- Empty/warmup-only completions are rejected before status/XP/badge/mission mutation; bodyweight/timed working sets remain valid. Explicit warmup capture survives offline sync and resume and does not advance the prescribed working-set count or create strength PRs.
- Analytics uses local inclusive-start/exclusive-end day bounds and excludes future workout timestamps. Radar excludes warmups; coach tonnage uses the athlete's calendar.
- Derived sets/protein missions recompute from persisted records, use shared Saturday period keys, and weekly claims work midweek. Removing meals recalculates progress without reopening a claimed reward.
- Goals reject invalid/past dates, already-met new targets and duplicate active type/scope/target creation; edited achieved targets are recomputed. Exercise-scoped strength goals anchor to the correct exercise. Legacy already-achieved goals report 100%.
- Session-list mutations serialize on the session row. Offline sync reuses the existing exercise log even if client ordering changes; swap checks unlogged planned targets as well. Existing histories are preserved.
- Seed uses a separate Bun tsconfig alias for the framework marker, without changing application imports; failures now propagate. Blank optional AI encryption settings preserve the existing SESSION_SECRET fallback.
- F31 distinguishes a zero quota; F32 adds needsOnboarding while preserving the old alias.

## Verification results

| Check | Result |
|---|---|
| Complete Vitest suite on disposable PostgreSQL 17.9 | 272/272 passed, 26 files (14 additional regression tests) |
| TypeScript | Passed |
| Production Next.js build, standalone packaging | Passed |
| Production HTTP smoke | Passed: demo OTP/session cookie, explicit onboarding field, empty/warmup completion rejection, persisted warmup resume, working completion/XP, analytics, role rejection, CSP/HSTS |
| ESLint | 0 errors; 2 pre-existing unused-directive warnings |
| Bun 1.4.4 seed on disposable database | Passed; all 4 member starter plans created |
| SQL prerequisite applied twice on isolated esifit schema | Passed; RLS enabled, anon SELECT and authenticated INSERT denied |

The new API regressions are included in the existing essential GitHub CI command. The original elapsed-time regression now logs a real set before completion, so it continues testing elapsed time without depending on the removed empty-workout loophole.

## Release prerequisite and limits

Before deploying this branch, run `docs/migrations/20261025071537_validated_audit_rate_limits.sql` as the existing server database-owner role against the production EsiFit database. It only adds `esifit.RateLimitBucket` and its index/permissions. Do not reset or re-seed production. A missing counter table fails closed; deploy the SQL before the code. Existing application tables and their grants are unchanged.

The CSP is a compatibility baseline: Next hydration still requires inline scripts, so this is not a nonce-based strict CSP or proof of complete XSS protection. Exercise imagery's existing external origin remains allowed. HSTS is sent only for production builds and does not opt other subdomains into a new policy.

Browser visual/IndexedDB interaction verification was unavailable: Chromium installation returned truncated/non-ZIP downloads. API sync persistence and resume are covered; no completed browser audit is claimed. Real SMS/LLM services, production RLS state and production deployment remain unverified.

Deferred product/configuration items remain F10/F11/F12/F13/F14/F23/F24/F26/F28 as detailed above. The report does not claim all 32 original entries were valid bugs or that the remaining four audit phases are complete.
