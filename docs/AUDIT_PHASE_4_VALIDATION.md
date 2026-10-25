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
