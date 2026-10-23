# EsiFit — Professional workout parity roadmap

Status: **in progress** · Source review: 2026-10-23 · Design: EsiFit's own RTL lapis/saffron system

## Intent
Build a complete guided training experience with the functional depth of
[openGym](https://github.com/DuarteSantos8/openGym), **independently implemented in EsiFit**.
Do not copy its proprietary artwork or source files into this private repository.
Preserve the existing 71 exercises, IDs, users, training history, offline operations,
database and existing session APIs.

## Verified inventory and licensing

| Source | What we may incorporate | What requires separate approval |
| --- | --- | --- |
| EsiFit own catalogue (71) | Own Persian text, instructions, movement patterns | Nothing |
| openGym current catalogue (6,554 JSON files, 2026-10-23) | Product ideas and independently implemented behavior | New catalogue text and code are generally AGPL-3.0; using them may trigger source-availability obligations |
| openGym's original 1,324 ExerciseDB-derived entries | Permissively licensed text/metadata **with MIT notice**; verify source marker per entry | Gym visual animations and stills are **not** included in MIT |
| openGym Gym visual stills and animations | No copying, embedding, hotlinking, extraction or AI-derived replacements into EsiFit | Written license from gymvisual.com, including trial/noncommercial use |
| RepDB Free Tier (650 exercises) | Flat WebP illustrations and in-app exercise information with visible attribution, including commercial use | No dataset redistribution/API, no paid-tier sample animations, no generative-AI derivatives |
| Our own original assets | Free of third-party dependencies, with original human-reviewed form guidance | Fitness-coach review before claiming medically/sport-scientifically accurate guidance |

**"Only testing" does not waive media licenses.** EsiFit on Vercel is a different
application from openGym and may be accessible over the network. Do not install
openGym media even temporarily. AGPL obligations cannot be postponed until launch.

## What is implemented now
- [x] Independent set logging and persistent rest timers (prior EsiFit work).
- [x] Offline write queue / history-aware suggested weights (prior work).
- [x] Branded **start and end** still illustrations for **46 exact matching existing EsiFit movements**, from RepDB Free Tier; static-only art when appropriate.
- [x] Visible RepDB attribution alongside full-size media; images gracefully disappear on load errors.
- [x] Existing Persian movement guidance stays intact, including unsupported media cases.
- [x] Source/license and replacement procedure tracked below.

These 46 matches **are not 650 imported new exercises**. No dataset or migration
was done by the visual-only change; this avoids data loss during user testing.

## Feature backlog — implementation order

### A. Exercise library and licensing
- [ ] Ingest up to **1,324 MIT-licensed ExerciseDB text records** via a reproducible source-tracked importer, with source attribution, translations and rigorous duplicate matching. Do not ingest media from that dataset.
- [ ] Catalogue browser with server pagination and searchable Farsi/English names, by muscle, equipment, ability, unilateral/cardio and movement pattern; retain existing curated Persian names.
- [ ] Import additional entries only when their licensing is verified **for this app**. The remaining openGym AGPL catalogue cannot be silently republished inside private EsiFit.
- [ ] Extend RepDB Free media mapping where accurate; prefer self-hosted assets for reliable production use. Ensure the available 650 images are reconciled against exact movements, not similar-looking names.
- [ ] Replace or license remaining instructional visuals; support still + custom video/GIF only with rights verification.

### B. Planning
- [ ] Editable plans by weekdays, including local **Jalali** calendar dates.
- [ ] Rotation A/B/C unrelated to fixed weekdays, manual reschedule/skip and deload blocks.
- [ ] Push/Pull/Legs, Upper/Lower, Full Body, 5×5 templates; individual per-set targets.
- [ ] Superset grouping and warm-up, working, drop, rest-pause and pyramid set types.
- [ ] Coach-created plans and customized rest, weights, and equipment availability.

### C. Real guided training (mobile-first)
- [ ] Current movement prominent; clear "**شروع ست → انجام حرکت → ثبت واقعی ست → استراحت → ست/حرکت بعدی**" with stable state, no spam taps.
- [ ] Warm-up rows separated from working volume; editable/reorderable target sets.
- [ ] Superset rotation and rest-phase coordination, per-set rest and optional holds.
- [ ] Time/distance/speed-based cardio and duration-based planks/carries; separate from kg×reps.
- [ ] Bodyweight vs assisted/added load; unilateral per-side entries.
- [ ] Optional RIR or RPE (not forced); rest completion haptics and screen-on mode.
- [ ] Edit/delete a mistaken set and undo; conflict-safe corrections across offline devices.
- [ ] Safe, confirmed end-workout and recovery of incomplete sessions.

### D. Intelligent progress
- [ ] Double/triple progression, linear and bodyweight time progression with visible reasoning.
- [ ] Missing rep = don't raise target weight; deload on stalls; user/coach override.
- [ ] Record detection, per-exercise 1RM charts, structural ratios and muscle recovery.
- [ ] Historical workout edits correctly recalculate records, volume and streaks.
- [ ] Personalized equipment plate loading (barbells, Smith/EZ/trap), and rest preferences.

### E. Quality gates
- [ ] Real-device Android + desktop usability, portrait keyboard and accessibility.
- [ ] Verify each exercise demonstration corresponds to the **exact** movement and equipment.
- [ ] Storage-level and UI tests for duplicate taps, offline retries, undo, rest restoration, leap-day dates and target set transitions.
- [ ] Keep GitHub CI green and Vercel preview healthy before each merge.
- [ ] No automatic production schema migrations or changes to existing history without backup.

## Production-readiness gate
1. Every displayed media file must have a recorded provider, original URL,
   content license, required credit and permitted deployment usage.
2. Prefer locally hosted, licensed copies for production rather than CDN hotlinks.
3. Remove any missing/uncertain license assets **before public release**, not after.
4. For openGym AGPL-derived source or new catalogue, seek explicit project owner
   approval of full source-sharing implications **before** copying.
5. If commercial/open-source decisions are still unsettled, implement equivalent
   functionality independently, referencing behavior, not code or copyrighted text.
6. Existing private Vercel trial currently uses the 46 permitted RepDB images
   with visible attribution; none of openGym's restricted artwork is used.

References:
- https://github.com/DuarteSantos8/openGym/blob/main/NOTICE.md
- https://github.com/DuarteSantos8/openGym/blob/main/catalogue/README.md
- https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md
- https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE
