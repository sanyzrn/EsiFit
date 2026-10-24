# EsiFit Campaign Hero — Charcoal × Performance Orange

**Scope:** landing hero only + shared semantic color refresh. No change to pricing,
roles, dashboards, training logic, API or database. Design reference 2026-10-24.

## References and design rationale
- User-supplied moodboard: five gym/fitness layouts; recurring themes are black/coal
  backgrounds, dramatic athlete photography, enormous expressive condensed type,
  red/orange CTAs, minimalist service rails, and high-contrast white copy.
- UI/UX Pro Max design intelligence (source: `nextlevelbuilder/ui-ux-pro-max-skill`,
  `.claude/skills/ui-ux-pro-max/SKILL.md`), its Fitness/Gym App color row suggests
  **#F97316 energetic orange + #1F2937 graphite** and a success green.
  We adapt charcoal levels to the existing EsiFit dark surfaces and warm light theme.
- WCAG 2.2 1.4.3/1.4.11: text AA >=4.5:1, large text/UI >=3:1.
- RTL-first: the copy precedes the art in DOM and visual hierarchy; meaningful
  CTA is above the fold on smaller phones. The dramatic art doesn't cover text.
- Editorial/art-direction style rather than a fake personal dashboard on a public homepage.
  The hero contains no invented performance statistics.

## Implemented tokens

| Purpose | Dark | Light |
| --- | --- | --- |
| Background | `#0B0D10` | `#F5F4F0` |
| Surface 1 | `#15171B` | `#FFFFFF` |
| Surface 2 | `#202328` | `#EFEDE8` |
| Primary CTA | `#F97316` / dark text | `#B3440F` / white text |
| Headline | `#F8F7F5` | `#1B1E23` |
| Secondary text | `#C1C5CC` | `#4A5059` |
| Success / positive | `#55D6A4` | `#087A58` |
| Alert/destructive | `#F04E57` | `#BB2834` |

**Verified contrast** (WCAG relative luminance calculation):
- Dark brand button `#F97316` / `#14100D` ~6.75:1.
- Light brand button `#B3440F` / white ~5.6:1.
- Dark foreground `#F8F7F5` / `#0B0D10` >18:1.
- New secondary text `#C1C5CC` against dark surface >9:1.

The legacy semantic color names remain for compatibility; they now map onto the
new active palette, while data-chart colors keep distinct hues.

## Replaceable hero photo

Hero portrait URL constant: `HERO_IMAGE` inside
`src/components/landing/hero.tsx`.
This points to an existing Unsplash free gallery image of a person lifting
a barbell (photo ID `1517836357463-d25dfeac3438`), used as a **temporary
licensed placeholder**. Color grading/shape are non-destructive CSS; the
original image is not edited and can be replaced later with owned brand
photography without changing hero layout.

Recommended for replacement: original portrait of an adult athlete in a
dark studio, with visible exercise equipment, strong side light, 4:5 crop,
and rights cleared for digital marketing use. Prefer local AVIF/WebP in
`public/media/` or a properly optimized project-owned image CDN rather
than external hotlinking before production scale.

## Accessibility / responsive
- Exactly one page H1 and short native Persian CTA copy.
- Real links: logged-out → `/auth/login`, authenticated → `/dashboard`,
  secondary → `/calculators`.
- High-contrast orange primary button, distinct secondary outline, focus-visible
  3px outline, >=52px CTA target, no hover-only actions.
- Scroll-safe mobile layout; photo follows primary content on small viewports.
- `prefers-reduced-motion`: removes hero Framer Motion entrance animation;
  photography/color remain intact.
- Existing other homepage sections are reused unchanged; no new dependencies.
- No unrealistic claims (e.g. fake customer satisfaction, calorie burned, or
  AI-generated exercise plans).

## Components touched
- `LandingHero({ signedIn })`: rewritten, same API, no duplicate component.
- `globals.css`: dark/light shared design tokens and `esi-campaign-*` hero art direction.
- `layout.tsx`: mobile browser theme colors updated.

## QA
- GitHub essential tests + Next.js production build.
- Manually verify 360px/390px mobile and 1280px desktop, both themes,
  low-data/image-unavailable fallback, tab keyboard focus, and reduced motion.
- Deliberately no automatic Vercel deploy; queued for one manual release.
