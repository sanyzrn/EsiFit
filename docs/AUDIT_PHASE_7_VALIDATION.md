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
