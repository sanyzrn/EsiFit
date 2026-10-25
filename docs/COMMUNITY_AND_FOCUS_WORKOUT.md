# Community and guided focus workout

## Scope and merge baseline

Based on `main` after PR #28. The other hero branch
`design/hero-athlete-responsive` had zero commits ahead of main, so there was
no competing hero implementation to merge. The athlete hero files and image
are retained. No schema migration, package upgrade or production deployment.

## Mobile community

Four member destinations plus an accessible More sheet keep all sections
reachable without shrinking navigation labels. Community is a direct tab;
Analytics, Achievements, Shop, AI, Notifications and Account remain in More.
Role and feature-flag filtering still use the existing navigation source.

Community supports public text posts, All/Mine filters, cursor pagination,
likes restored from the signed-in viewer, paginated comments, text sharing,
and ownership-scoped delete confirmation. Per-post client locks serialize rapid taps in one browser; server-side shared
quotas also limit write volume. Those client locks do not serialize requests
from different devices. Whitespace-only posts/comments are rejected server-side.
Failures remain visible and retryable rather than looking like empty feeds.
Moderation deletes posts; the schema does not have a hidden-post state.
Deleted/nonexistent posts do not expose comments or accept reactions. Personalized feed
responses are private/no-store. Private challenges stay scoped to members or
owners; membership is read separately from the top-ten leaderboard.

## Workout composition and design tokens

The existing HUD owns all workout state and remains fixed to the viewport.
Focus mode shows one movement on a large canvas, its planned sets/reps, an
active-set count-up timer, pause, actual set capture, and previous/next actions.
A detail toggle retains history, warm-up, plate calculations, swapping,
exercise selection and the existing detailed capture UI. The same capture JSX
is reused in the focus Sheet; there is no second logging implementation.

Layout tokens are scoped to `.esi-workout-focus` in globals.css:

| Token | Value |
| --- | --- |
| `--workout-art-min-height` | 192px |
| `--workout-art-landscape-height` | 224px |
| `--workout-control-min-width` | 320px |

All colors, radii, type and interaction primitives reuse the existing semantic
system. Mobile stacks image and controls; desktop places them beside each
other. Short viewports can scroll; controls retain touch targets.

The existing RepDB start and peak frames alternate after both load. They are
not an interpolated video and do not count repetitions. Pause and manual pose
selection are available; reduced-motion disables automatic playback. Single
illustrations stay static. Unsupported/error media show canonical exercise
instructions instead of substituting a different movement. Media provenance
and attribution remain in EXERCISE_MEDIA_LICENSES.md.

The set timer counts elapsed working time; it is not a fabricated timed
prescription. It pauses during capture/rest and preserves explicit pause
across reload. Rest uses the existing persisted wall-clock countdown, now
also between movements, except after the last planned set of the session.
Focus rest fills the viewport with the countdown, existing +/-/pause/skip
controls, and an accurate next-set or next-exercise preview. Leaving rest is
explicit; completion is never inferred from an animated pose or timer.

## Verification

- Focused local clock/media tests cover wall-time, pause/resume, reload and
  corrupted clock recovery.
- CI includes real PostgreSQL community tests: pagination, persisted reactions,
  whitespace validation, deleted-post access, ownership/cascade delete, and
  challenge membership below tenth place.
- Browser UI QA uses disposable visual fixtures, never production user data.
- Production build and strict TypeScript are required after fixture cleanup.
- Lighthouse was not measured. Full production account/database flows are not
  claimed from visual-fixture testing.
