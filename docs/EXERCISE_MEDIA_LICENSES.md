# Exercise media policy — EsiFit

Updated: 2026-10-23

**Permission does not change just because a site is a demo.**
The app must not embed/download/hotlink openGym's Gym visual stills or
animations, even on a short-lived trial. The source project explicitly
states its exclusive license does not extend to independent websites/apps.
For reuse, obtain an independent written license from https://gymvisual.com.

## Current EsiFit training imagery
- Source: [RepDB Free Tier](https://github.com/RepDB/exercise-dataset)
- License: [LICENSE-DATA.md](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md)
- Attribution shown next to every expanded exercise image:
  **Exercise data by [RepDB](https://repdb.co)**
- Current exact matches: **46 / 71 EsiFit exercise slugs** (40 start+peak;
  6 single illustrations). No inaccurate lookalike substitution.
- Technical map: `src/features/workouts/data/exercise-media.ts`
- UI: `src/features/workouts/exercise-visual.tsx`
- Media resolution: licensed flat-style WebP from public RepDB free-tier
  endpoint. **No** premium samples, no generative style transfer, no dataset API,
  no redistribution of downloaded image archives.
- Trial uses the RepDB public static images with graceful offline/error fallback;
  move licensed images to first-party hosting before production scale to avoid
  relying on third-party network availability. Retain attribution and terms.

## Replacing the visuals later
1. Acquire source media with valid rights for commercial in-app use.
2. Confirm its exercise naming maps to exact movements and equipment.
3. Preserve start/peak distinctions, alt text, a11y fallback and credit.
4. Replace only `exercise-media.ts` and the presentation component.
5. Validate on mobile and run CI, verify media does not expose user data.
6. Keep provenance and license entries in this file.

## Copyright/code separation
- AGPL-3.0 covers openGym's own code and newer catalogue content.
  Copying it into a hosted private EsiFit adaptation may create network-source
  disclosure obligations. Do not do so without explicit source-license review.
- The 1,324 original ExerciseDB records have an MIT-covered **text/data layer**
  (attribution required), **not** media permission. Their Gym visual GIFs and
  thumbnails remain independently restricted.
- EsiFit's own existing 71 Persian entries remain its canonical dataset.
- Reimplement UX mechanics independently from observed behavior.

For code review, new workout media must include a source and license note.
