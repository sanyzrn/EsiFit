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

## Athlete cutout and responsive composition — 2026-10-24

The user-supplied orange-shirt portrait replaces the placeholder photo. The
background is extracted with ImageGen; skin, clothing, pose, phone, watch and
warm rim lighting are retained. The production asset lives at
`public/media/esifit-athlete.webp`, with real alpha and no baked-in backdrop.
Next Image serves responsive sizes and preloads the local hero asset.

`LandingHero({ signedIn: boolean })` keeps its existing API and reuses `Button`.
No new component, flag, entity, dependency or backend behavior is introduced.

### Composition tokens (scoped to `.esi-campaign-hero`)

| Token | Value / purpose |
| --- | --- |
| `--hero-section-height` | `clamp(720px, 100svh, 900px)` desktop canvas |
| `--hero-art-height` | `400px` phone, `520px` tablet; desktop fills canvas |
| `--hero-display-size` | `clamp(3.25rem, 13.3vw, 4rem)` phone; `clamp(4.5rem, 11vw, 6.4rem)` tablet; `clamp(5.75rem, 8.2vw, 7.75rem)` desktop |
| `--hero-art-width` | `400px` phone, `440px` tablet; desktop uses left grid column |
| `--hero-cta` / `--hero-cta-hover` | `#f97316` / `#ff9b4a` |
| `--hero-alert` | `#f04e57` title punctuation |
| `--hero-art-wash` | subtle warm background behind portrait, not a photo frame |

Desktop: copy in the right column, large unframed athlete bottom-aligned in the
left column, with breathing room below the fixed navbar. Mobile: centered copy,
a two-line headline, two side-by-side pill actions (stack below 360px), then a
waist-up portrait with a subtle bottom fade into the shared feature rail. At
640–1023px the portrait is taller and the title uses three lines. Text never
overlays the athlete. At 1024px and above the headline returns to three lines.
Feature benefits reuse the existing three items, arranged in three equal columns.
The photograph is intentionally static; only a restrained CSS entry animation uses
the existing smooth duration/easing tokens. Hero content is server rendered and
stays visible even when JavaScript is unavailable; no Framer Motion hydration
is needed for this section.

## Accessibility / responsive
- Exactly one page H1 and short native Persian CTA copy.
- Real links: logged-out → `/auth/login`, authenticated → `/dashboard`,
  secondary → `/calculators`.
- High-contrast orange primary button, distinct secondary outline, focus-visible
  3px outline, >=52px CTA target, no hover-only actions.
- Scroll-safe mobile layout; cutout follows primary content on small viewports.
- `prefers-reduced-motion`: removes hero CSS entrance animation;
  photography/color remain intact.
- Existing other homepage sections are reused unchanged; no new dependencies.
- No unrealistic claims (e.g. fake customer satisfaction, calorie burned, or
  AI-generated exercise plans).

## Components touched
- `LandingHero({ signedIn })`: rewritten, same API, no duplicate component.
- `globals.css`: dark/light shared design tokens and `esi-campaign-*` hero art direction.
- `layout.tsx`: mobile browser theme colors updated.

## QA — athlete revision

- `npm run build` passed, including strict TypeScript and standalone packaging.
- Browser inspected at 1363px desktop and in 320px, 390px and 768px frames.
- Local optimized image loaded successfully; source WebP is ~169 KiB and has alpha.
- Hero itself has no horizontal overflow at 320px; 390px document has none.
- Mobile hero links remain `/auth/login` and `/calculators`, both 52px tall.
- Hero content is visible in server HTML without waiting for client hydration.
- Reduced-motion CSS disables the entry animation. Lighthouse score was not measured.
- Database/API tests are not relevant to this presentation-only change and were not run.
- Deliberately no Vercel deploy: retain the existing manual release workflow.
