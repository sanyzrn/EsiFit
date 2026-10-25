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
