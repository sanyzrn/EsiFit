# EsiFit — Flat interface refresh (24 Oct 2026)

## Intent and references

The user supplied three mobile fitness references: clean dark cards + restrained salmon accents; a light typographic and activity-focused layout; and a minimal profile/report hierarchy. UI/UX Pro Max principles applied: minimum 44px touch targets, mobile-first layout, up to five bottom navigation items, meaningful states, contrast and role-aligned navigation.

**Do not imitate screenshot-specific brand assets or add fake metrics.** Preserve actual product data, copy, role boundaries, and existing API/offline behavior.

## Scope

- **Dark:** charcoal `#0B0D10`, solid surfaces `#15171B`/`#202328`, brand orange `#F97316`, text `#F8F7F5`.
- **Light:** warm off-white `#F5F4F0`, solid white panels, readable charcoal text, darker contrast-appropriate orange `#B3440F`.
- **No glass**, backdrop blur, global grain, card spotlights, exaggerated/drop shadows, decorative glow, rainbow gradients, large hover translations, or animated selection pill.
- **Brand campaign hero**: preserves the athlete/layout and dark campaign, with full light-theme parity (25 Oct revision below).

## Component changes

- `MobileBottomNav`: anchored edge-to-edge, solid background + top border and safe-area padding. Active tab is identified by color plus a thin top indicator; no floating pill, shadow, glass or animations. Actual route+flag+role source remains shared with sidebar.
- `AppSidebar`, `AppShell`: opaque layout chrome, stable no-motion navigation. Admin/coach retain their own destinations.
- `DashboardView`: work-first hierarchy:
  1. Date and greeting
  2. Continue/start today's workout (primary action)
  3. Current readiness / progress summary
  4. Macro tracking / water shortcuts
  5. Goals and weight history
  All important numbers have explicit accessible textual labels; empty and offline states use existing APIs/cache. Water mutations and active workout deep links are unchanged.
- `Button`, `Card`, `Progress`, `Tabs`: shared styles are flat, using existing semantic color tokens, borders and stable layouts.
- `KhatamDial`, `MacroRingGroup`: no glow/drop-shadow; keep accessible numbers and data visualization. Logo remains a recognizable flat Khatam mark.
- `PublicNavbar`: mobile menu is a solid accessible panel, without animated transformation.
- `globals.css`: palette retained, existing legacy elevation tokens mapped to none so old modules are visually consistent without invasive rewrites.

## QA checklist

- Dark and light backgrounds, including sufficient text/button contrast.
- 320, 360, 390px mobile bottom navigation: five destinations maximum, text not overlapping and 44px+ tap targets.
- Main dashboard no horizontal scroll; easy resume session and quick water entry, offline queue remains functional.
- Navigation after role switch: admin/coach never see athlete fitness destinations.
- Public hero and lower marketing sections respect the selected theme.
- Reduced motion and keyboard focus are still respected.
- GitHub CI only. Vercel Git-based deployment disabled in `vercel.json`; one explicit production deploy on latest `main` only.

## Public social card
The 1200×630 export uses existing dark background/text/primary tokens, the approved gradient mark, Lalezar and Vazirmatn with the existing 32/64px spacing rhythm. scripts/generate-social-card.mjs regenerates it with an optional local browser runtime. This adds no product theme or runtime dependency.

## Light hero and waiting states — 25 Oct 2026

- The light campaign uses the existing warm background, white strip, charcoal text and AA orange primary tokens. Dark campaign values stay intact. Secondary buttons, dividers, side label and art stage follow the same theme; light mode removes dark photo grain/glow.
- `--hero-athlete-image` selects one local transparent WebP from the root theme class. The server-rendered semantic image keeps the original framing; CSS selection avoids client hydration switching or downloading/preloading both variants. The persisted theme is applied by the existing next-themes script. Portraits are already optimized at 960×1440; no new dependency or client island.
- `esifit-athlete-light.webp` is a built-in image edit of the existing supplied portrait: preserve identity/pose/clothes/phone/watch and transparent silhouette, replace harsh orange rim light with soft neutral daylight and balanced natural skin. Original dark artwork is preserved. Generated source is converted to WebP with its alpha intact (141 KB).
- Shared `BrandLoader` reuses the approved `BrandLogo`, 24/64/96px spacing/sizes and semantic palette. A subtle logo breath and three sequential progress strokes use existing motion presets. Reduced motion is static. It is connected to real private-route suspense and workout session startup; there is no artificial delay or fake percentage. Shape-specific content skeletons remain in place elsewhere.
- Back chevrons point right in Persian; only LTR mirrors the right-pointing path. The mobile More sheet has no corner close icon: a full-width labeled dismiss action follows its links. Backdrop, Escape, focus trap/return and navigation dismissal remain provided by Radix.

- Branded route suspense is scoped to authenticated/auth flows, not the root layout. Public pages retain visible server-rendered content when JavaScript is disabled; no global fallback hides the catalog/landing page.
