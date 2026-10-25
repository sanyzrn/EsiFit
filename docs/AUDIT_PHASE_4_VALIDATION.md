# Independent validation — audit phase 4 (PWA and engagement)

Source notes audited main `93c405f`; this validation uses `b46fcce`, including the pending phase 1–3 fixes in PR #34. No production deployment or database mutation is part of this phase.

| Finding | Independent verdict before implementation | Repair decision |
|---|---|---|
| F33 | Confirmed: only join/seed write challenge scores; no scoring/settlement/invitation engine. Severity is product integrity, not a demonstrated security compromise | Use the report's explicit alternative: disable CHALLENGES and PRIVATE_CHALLENGES by default; enforce the flag at the API, preserve records, and remove random seed scores. Full competition lifecycle remains unshipped |
| F34 | Current-period weekly claim already fixed in PR #34. Past completed unclaimed periods still disappear | Preserve access to earned pending rewards by explicit validated period keys, with ownership checks and idempotency |
| F35 | Already fixed as F18: daily sets and weekly protein derive from persisted data | Retain and regression-test; do not duplicate writers |
| F36 | Confirmed: water_days, nutrition_days and early have no evaluator; evaluation runs only on workout completion | Shared badge evaluation for workout/water/nutrition and achievements catch-up; lifetime/consecutive-day semantics match badge descriptions |
| F37 | Empty and warmup-only completion already rejected in PR #34 | Recheck XP/badge/mission boundary; self-reported valid workouts are not proof of complete anti-cheat |
| F38 | Confirmed: 60-workout and 60-day truncation; lifetime volume badges also incorrectly use only the last 60 workouts | Calendar-day streak helpers without arbitrary history caps; include nutrition as the existing activity-streak comment promises; lifetime volume aggregation |
| F39 | Confirmed: like writes have no limiter | Use the existing shared PostgreSQL limiter after authentication/validation |
| F40 | Confirmed: permanent HTTP 4xx failures remain retryable forever | Park permanent failures, preserve 401 and transient failures; require an explicit successful server acknowledgement before deleting queued data |
| F41 | Confirmed: finish ignores outstanding/failed/conflicted session ops; sync can append new sets to completed sessions | Block completion until that session's queue is confirmed empty; serialize completion with sync and reject new late sets while preserving idempotent replay |
| F42 | Confirmed: future completedAt is persisted. The claim that it has no readers is now stale: PR #34 uses it for daily-set missions | Clamp future timestamps at sync boundary, retain historical offline timestamps |
| F43 | Partly confirmed: per-op requests contradict the comment; water progress is written only after completion. The alleged 2/1 display is unsupported: AchievementsView already clamps displayed progress | Correct the comment; derive gradual mission progress against its own target, preserve profile water target separately |
| F44 | Confirmed unsupported challenge invitation/reward fields and unused private flag; workout sharing is a missing feature, not a regression | Disable unsupported challenge features with F33; do not invent workout-sharing or invitation workflows in an audit repair |
| F45 | Confirmed missing mission notification. The appended zero-AI-quota remark is stale after F31 | Create claim, XP and notification atomically once; retain existing toast and add no unsolicited notification channels |

## Method boundary

Previous-agent curl results and positive PWA claims are not automatically considered reproduced. IndexedDB and service-worker regressions will be tested with deterministic platform emulation; real browser installation/cache behavior is reported separately if unavailable. Existing account histories and original uploaded reports are preserved. Only relevant regression checks are added.

## Additional PWA check

The positive S29 claim needed a boundary correction: an API URL opened as a top-level navigation reached the navigation-cache branch. `sw.js` now explicitly bypasses `/api` and `/api/*` before examining navigation mode; the cache version advances to v6 to discard obsolete cached responses. A regression covers both fetch-mode and navigation-mode API requests. This is a code finding, not a claim of an observed production leak.

## Implemented behavior

- Challenges/private challenges default off at UI and API; no competition records are deleted. Seed participants no longer receive random scores. The full scoring/invitation/winner engine remains explicitly deferred, using the report's disable-until-ready recommendation.
- Shared badge evaluation handles all catalog criteria, runs on water/nutrition/workout events and catches up on the achievements page. Consecutive-day rules deduplicate days; current streak includes nutrition and lifetime statistics no longer stop at 60 sessions/days. Badge, badge XP and notification are atomic and unique.
- Mission progress is persisted on relevant writes using the activity's calendar period, including delayed offline entries. Protein weeks use the whole available week so backdating an entry does not truncate later-day progress. Water progress is gradual against the mission target.
- Completed historical progress records remain visible as pending rewards (up to 50 per response, with the next records becoming visible as rewards are claimed). The claim API accepts a validated day/Saturday key, checks ownership, and commits claim/XP/notification together. Old and new request shapes remain compatible.
- Permanent queue rejections are parked; 401/auth expiry and transient network/HTTP failures preserve pending data. A malformed HTTP 200 cannot silently delete a set. Workout completion checks only that workout's durable queue and fails closed if the store cannot be read. Terminal conflicts require a separate explicit action to finish only accepted sets; rejected local records are preserved. Pending transient operations cannot be bypassed by that action.
- Sync and completion share a session row lock. Already-saved client IDs can be replayed after completion; new late sets are rejected, keeping volume and PR snapshots consistent. Future completedAt values are clamped, while historical offline times are kept.
- Likes use the existing shared database limiter. Service-worker v6 explicitly excludes APIs even during top-level navigation.

## Verification

| Check | Result |
|---|---|
| Complete suite on disposable PostgreSQL 17.9 | 301/301 passed, 29 files |
| Final IndexedDB/service-worker regressions | 22/22 passed; permanent/transient errors, malformed responses, in-flight ordering, strict completion guard, logout purge and cache boundaries |
| Phase-4 database/API regressions | 7/7 passed: badge events/catch-up, 70-day streak with 90 sessions, nutrition-only streak, old/concurrent/cross-user reward claims, like caps, partial water, timestamp clamp and late sets |
| TypeScript | Passed |
| Production standalone build | Passed using an isolated build directory |
| ESLint | 0 errors, 2 existing unused-directive warnings |
| Built production HTTP smoke | Passed: demo login/cookies, warmup persistence, completion guards, blocked late writes, disabled challenges, mission periods, claim replay and served SW v6 |

The first complete-suite attempt exposed a test-fixture cleanup omission (challenge records survived between runs); the shared fixture now clears those records in dependency order. The normal build directory was still used by the prior smoke server, so verification used the supported isolated build directory. Neither issue was papered over by weakening assertions. GitHub CI uses a fresh checkout and runs the new API regressions as well as unit tests.

## Remaining boundaries / release hold

No live migration, merge or publication was performed. Publication stays on hold until all seven supplied audit reports are addressed. Phase 4 introduces no additional database migration; the phase 1–3 RateLimitBucket prerequisite still applies before the eventual release.

IndexedDB and worker tests use platform emulation, not a claim of a completed real-browser installation/offline/visual audit. Chromium downloads were unavailable in the prior verification attempt; no browser-quality/Lighthouse score is invented. Real SMS/LLM services were not called. Historical water targets are not versioned by the existing schema; badge evaluation uses the current profile target. Workout sharing, invitation workflows and competition settlement remain unshipped product features, documented rather than represented as working.
