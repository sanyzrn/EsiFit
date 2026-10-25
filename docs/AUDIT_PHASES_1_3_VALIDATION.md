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

Positive security claims in the supplied notes describe valuable existing controls, but do not constitute a new penetration test or independent confirmation of every prior test. No live SMS, LLM credential, production database, or deployed-site penetration test is authorized by this local regression workflow. Test outcomes and remaining deployment prerequisites are recorded after implementation below.
