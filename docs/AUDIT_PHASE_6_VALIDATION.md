# Independent validation — audit phase 6 (UI/UX and public site)

Review baseline: PR #34 at `4a52ff3`, including the pending repairs from reports 1–5. The report audited unchanged main `93c405f`. Main, production data and deployment remain untouched until all seven reports are addressed.

| Finding | Independent verdict before implementation | Decision |
|---|---|---|
| F54 | Confirmed: no localized not-found component | Add a Persian branded 404 using existing shell/buttons and recovery links |
| F55 | Confirmed: main landmarks have no shared skip target/link | One root skip link and consistent focusable main target across app/public/offline/404 |
| F56 | Confirmed: forced dark theme hides a working toggle; attached and current design docs explicitly require theme parity | Reuse ThemeToggle in public/mobile/desktop/auth chrome and unlock theme selection while preserving dark default |
| F57 | Confirmed: public store is disallowed, absent from sitemap and initially renders no products | Share the catalog query/DTO between SSR and API, render current prices server-side, add catalog error/retry, correct robots/sitemap and canonical metadata |
| F58 | Reported Radix warning is not independently reproduced; initial render does use server/browser local time and can differ | Remove the proven clock mismatch source with a stable initial snapshot; no claim that every possible hydration cause is solved |
| F59 | Confirmed: guarded pages and OTP/onboarding discard destination | Validate an internal destination centrally, preserve it through member/staff guards, login and onboarding; reject external/protocol-relative/auth/API redirect targets |
| F60 | Localhost in a local environment is expected; live deployment configuration was not inspected | Centralize validated origin resolution with explicit site URL and Vercel environment fallbacks; document eventual release configuration, no live env mutation |
| F61 | Confirmed uncached article queries; whole-page ISR is unsafe without separating personalized shell/session data | Cache published editorial DB reads for 60 seconds only; keep account, stock, prices, sessions and role-specific HTML dynamic |
| F62 | Confirmed square app-icon fallback for wide social cards | Add a dedicated 1200×630 branded card with reproducible source and use it in public metadata |
| F63 | Spacing is a subjective observation; English eyebrow/RTL arrows are intentional; dev overlays are not product defects | Tighten the hero-to-features spacing using existing tokens; retain deliberate art/RTL and exclude dev overlays from product claims |

## Additional validation boundaries

The positive claims are not accepted as new evidence. Current public child routes also inherit the root `/` canonical and OG URL unless overridden; correct route-specific metadata while touching those SEO surfaces. Article metadata currently reads drafts without checking publication status; scope shared editorial queries to published content.

Public pages use session-aware chrome, so shared full-page caching could leak member state. Editorial caching must contain no cookies, user IDs or member pricing. The report's sitemap count is internally inconsistent: 5 static + 8 calculators + 5 categories + 11 articles totals 29, not 25; verify actual URLs rather than repeat that count.

A real browser will be attempted using an isolated scratch-only Chromium runtime. No screenshot, contrast, Lighthouse or mobile-install result is claimed until measured. Uploaded source reports remain unchanged; no new database schema or feature flag is planned.

## Repairs and verification history
All confirmed repairs were implemented before the scratch workspace was automatically pruned: Persian 404, shared skip target, persistent theme selection, SSR catalog/public discovery, route-specific canonical/social metadata, validated destinations through OTP/onboarding, 60-second published-editorial data caching, and a wide brand card. Real Chromium had reproduced reduced-motion hydration failures in ScrollProgress/AnimatedCounter; a shared hydration-safe preference hook fixes the root cause in all animated consumers. Dashboard time also has a deterministic first render. DayFlow text no longer dims to low contrast.

Before pruning, 319 tests passed; real-browser flows at 390×844/1280×800 had zero page errors, keyboard skip focused main, themes persisted, and new-member onboarding returned to the requested settings page. Twelve settled axe checks across six public pages × dark/light had zero violations. Mobile Lighthouse measured landing 78/100/100/100 and store 84/100/100/100 (performance/accessibility/best-practices/SEO). These were measured facts, not a 95+ performance pass.

The rebuilt source is being validated again with patched dependencies in phase 7. Exact old local commit/tree identity is not claimed. Performance remains below 95 and needs a separate measured public-bundle/LCP improvement before a claim of meeting that target. Caching personalized HTML is deliberately avoided to preserve privacy and current prices. No real-device install/offline or live-provider success is inferred from UI checks.

## Revalidated reconstructed release candidate

- Strict standalone production build passed on Next 16.4.3. ESLint is now zero-error/zero-warning.
- Complete API/unit suite: 322/322, 33 files, disposable PostgreSQL 17.9. After the test-tool security patch, the six targeted URL/body-parser checks also passed on Vitest 4.1.12; CI runs the entire suite on that toolchain.
- The reusable local browser runner passed both viewports, persistent light theme, keyboard skip, member OTP destination, new-member onboarding with Persian numeric input, visible no-JavaScript catalog, 413 oversized-body rejection and real production service-worker offline fallback/API network-only behavior, with zero page errors. This does not establish physical-device installation or live-provider behavior.
- Latest mobile Lighthouse on this runner: landing performance 75 and store 70; accessibility, best-practices and SEO all 100 on both. Earlier busy-run performance scores varied considerably. The 95+ performance target is not claimed. Editorial data caching, lighter public dependency boundaries, on-demand interface fonts and viewport-deferred decorative studies are implemented; a further measured LCP/bundle optimization is explicitly deferred.

### Documented performance exception
For the existing test/demo release, keep the interactive product surfaces and session-aware rendering while protecting private data and live stock/discount correctness. Shared full-page caching would be unsafe for these responses. This is a documented exception to the 95+ target, not a performance pass or a commercial-production-readiness assertion. Real payments/refunds, erasure, competition settlement and push remain unavailable.
