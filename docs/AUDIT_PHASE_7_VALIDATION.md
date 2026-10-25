# Independent validation — final audit report (phase 7)

Baseline is PR #34 at `4a52ff3` with phase-6 repairs being reconstructed after automatic workspace maintenance. The supplied report repeatedly tests unchanged main `93c405f`; its claim that no findings were fixed does not describe the pending PR. Phase-specific validation documents remain the evidence for those repairs. No production migration, merge or release is part of this validation commit.

| Finding | Independent verdict before implementation | Decision |
|---|---|---|
| F64 | Fresh `npm audit --omit=dev` confirms 12 affected package nodes: 1 critical, 7 high, 4 moderate. Maintainer advisories confirm Next <16.4.1 and Zod <4.6.6 are affected; current lock still falls within those ranges | Upgrade compatible patched Next/Zod/sharp releases; remove unused vulnerable chains, inspect remaining transitive advisories without a blind major migration; add production audit gate and bounded JSON request parsing |
| F65 | Confirmed no editor/highlighter imports in source/scripts | Remove both unused direct production dependencies and refresh both lockfiles |
| F66 | Confirmed CI still selects API files, despite additions from repairs 1–5 | Run the complete suite and production audit in CI |
| F67 | Empty-workout and like-server defects already repaired in phases 1–4; community document still describes nonexistent hidden status and overstates client reaction locks | Correct documents around actual server predicates, quotas and UI serialization |
| F68 | No application LICENSE exists; choosing an open-source grant is an owner decision, not a bug repair | Document current unlicensed/private package status without inventing an MIT/Apache grant; keep third-party licenses/attribution intact |
| F69 | Confirmed no Web Push lifecycle; report explicitly calls this an absent product feature | Document future opt-in push work; do not pretend that in-app notifications are OS push or introduce unconfigured delivery jobs |
| F70 | Confirmed destructive default db:push, no engines and two unused lint directives | Remove baked-in accept-data-loss; declare supported runtimes and make lint zero-warning |

Security information was independently checked against the current npm advisory response and primary upstream advisories/releases, rather than copying the report's exact patch/exposure claims. Sharp is also used by Next image optimization, so calling it build-only understates runtime exposure.

Before release, validate repairs against the new installed tree, assess local Lighthouse performance below 95, and distinguish a test/demo release from unavailable real payment, account-erasure and competition/push features. Real SMS/LLM/payment provider verification and physical iOS/Android testing require their own configured environments; no such success will be claimed here.

## Dependency decisions
Next 16.4.3, Zod 4.6.7 and Sharp 0.35.5 are compatible patched releases; ESLint config follows Next. Removing the unused editor/highlighter removed 177 packages. source-map-js was updated within its supported range. Prisma remains at 6.19.3; its CLI is development tooling, but npm still includes it through the client optional peer. Its remaining advisory comes from deepmerge-ts 7.1.5. A narrow @prisma/config override uses 8.0.0 instead of forcing an ORM 7 migration. Upstream 8.0.0 retains deepmerge; the behavior change concerns Map merging and circular graphs, while the existing Prisma config path uses plain configuration objects. Prisma client generation, schema push and full API tests must pass against the override.

Primary references: https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw ; https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 ; https://github.com/advisories/GHSA-ggr8-5vv4-36mx ; https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0 .

## Verified candidate

- Fresh npm audit across **all** installed dependencies, including development tooling: zero advisories in every severity. Vitest was patched to 4.1.12 and Vite to its compatible patched release as well as the runtime packages. Both npm and Bun lockfiles were refreshed; Bun resolves deepmerge-ts 8.0.0 too.
- Prisma 6.19.3 client generation, schema push to disposable PostgreSQL, seed including all four starter plans, strict production build, zero-warning lint and the complete 322-test suite passed after the configuration dependency override.
- Shared JSON parsing caps every JSON write at 1 MiB before parsing/Zod; declared and chunked/unknown-size bodies are checked, streams are canceled on overflow, malformed JSON returns 400, and the supported empty workout-start body is retained. Browser HTTP confirmed 413 without invoking OTP.
- Browser tests now have a reusable scripts/verify-public-site.mjs runner guarded to disposable local databases. CI runs every unit/API file plus a high-severity audit across the complete dependency tree. No browser download or live credentials are added to CI.
- Supabase/Vercel release prerequisites were inspected read-only: the production esifit schema exists and RateLimitBucket is absent. Its reviewed additive migration is required before eventual promotion. Automatic Git deployments remain disabled.

See AUDIT_FINDINGS_STATUS.md for all F1–F70 dispositions. Product features identified as absent/informational are described honestly rather than implemented as placeholders. The measured performance exception and remaining live-service/device limits remain explicit. No merge, live migration or deployment was performed during these candidate checks.
