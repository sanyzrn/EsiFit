# EsiFit — Minimal flat UI refresh (October 24, 2026)

## Scope / reference
Applied to the **authenticated dashboard, all shared application navigation,
shared page headings, inputs and tabs, and the public non-hero chrome**.
The marketing hero from PR #21 is intentionally **unchanged**.

Reviewed the actual `ui-ux-pro-max` skill at
`nextlevelbuilder/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/SKILL.md`
and its mobile visual/accessibility checklist. Applied its guidance on
44–48px targets, navigation ≤5 items, clear focus, contrast, safe areas,
clean vector iconography and motion that conveys meaning. The screenshots
supplied in this task are *inspiration*, not source code or image assets.

## Design decisions
- **No shadows, glow, floating glass nav or glossy gradients.** Flat surfaces
  are separated by a 1px semantic border and spacing. No decorative motion.
- Brand palette **stays consistent** with already-merged hero:
  `--background`, `--surface-1`, `--surface-2`, `--border`,
  `--primary` (orange), `--text-primary`, `--text-secondary`.
  Both dark + light mode are token-driven; no arbitrary new hex in components.
- Mobile nav is full-width and **anchored to the screen edge**, with 5 or fewer
  role-appropriate destinations; active state is a small flat tinted *icon*
  background and selected text, not a bright outline, glowing effect or
  floating pill. A separate device safe-area is reserved below the bar.
- App content bottom spacing accounts for 68px tab bar + safe area.
  Primary nav links keep `aria-current=page`; targets meet touch minimum.
- Dashboard prioritizes: greeting → TODAY'S TRAINING →
  QUICK STATUS → NUTRITION/WATER ACTIONS → HISTORY/GOALS. A session that is
  active still says **Continue**, not Start; rest days still show recovery.
- Dashboard metrics become **two-column on phones** (readiness and
  training level) with calories full-width if readiness is enabled; three
  columns on desktop. No misleading sample data is introduced.
- Existing offline water logging, workout session API, settings, roles,
  limits, subscription and coach behavior remain intact.
- Shared public non-hero navigation and footer are visually simplified;
  the marketing hero is excluded from these changes.
- Standard inputs, tabs, page headers and the account button now follow
  one restrained visual hierarchy across app pages.

## Delivery checks
- [ ] On 360–390px, navigate between Home / Workouts / Nutrition /
      Progress / Account. Bottom bar does not overlap content.
- [ ] Log water with +250/+500/+750 buttons; check pending/failed states
      and offline queue behavior.
- [ ] Confirm today's workout CTA offers Continue for active sessions,
      Start for new sessions and rest text for rest days.
- [ ] Verify member vs coach vs admin bottom navigation stays distinct.
- [ ] Review light/dark contrast and visible keyboard focus on all tabs.
- [ ] Verify marketing hero unchanged (PR #21).
- [ ] GitHub Actions essential test + production build passes.
- [ ] **Do not auto-deploy**: `git.deploymentEnabled=false` remains.
      Batch changes and manually deploy newest main commit upon request.

Only source components and styling are modified; no database changes.
