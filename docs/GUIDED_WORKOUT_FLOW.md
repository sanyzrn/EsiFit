# Guided workout flow — EsiFit

Updated 2026-10-24. Reference: [openGym](https://github.com/DuarteSantos8/openGym) interaction research. **Independent implementation; no copied AGPL code.**

## Actual member flow
1. On **Workouts**, show **Start** for new sessions and **Continue workout** for an existing owned session, not multiple starts. A resumed session reopens at its first unfinished exercise.
2. Open the fullscreen focus canvas by default, with looping start/peak teaching frames, an active-set count-up clock and actual set capture in a Sheet. Detail view remains available. Show one focused exercise and its planned/recorded sets. The current set can only be recorded once; local offline persistence happens before the UI marks it done.
3. Start the programmed rest between sets and movements, except after the last planned set of the session. Focus mode uses a full-screen rest phase with a next-step preview; detail mode retains the **bottom-docked** timer with a slim progress bar and stable control positions. It runs on wall-clock time.
4. Expose **−15 / +15**, **Pause / Resume**, and **Skip (two-step confirmation)**. When the timer reaches zero, display **Ready** rather than abruptly removing the bar. Athletes may explicitly dismiss it or add 15 s. A tab going to the background does not freeze the clock; pause is intentional.
5. When all planned sets for a movement are recorded, show a clear **next exercise** action; after the last movement, ask to finish the workout.
6. **Exit** to library preserves the session for continuation. **Finish** opens a confirmation with actual sets, percentage, elapsed session time and an unfinished-workout warning. The API rejects completion without a saved working set, including warmup-only sessions, before XP/badge/mission awards. Such sessions may be left active; completed sets stay intact.
7. If offline, completion fails safely and the session remains active. Existing workout summaries/PR calculations and server API persist.

## Source comparison
Studied openGym's rest dock / pause / +/- / Ready patterns; routine start vs freestyle behavior; finish/cancel distinctions. See:
- `frontend/src/components/RestTimer.jsx`
- `frontend/src/components/WorkoutSettingsSheet.jsx`
- `frontend/src/lib/session-start.js`
- `frontend/src/lib/finish-workout.js`

This comparison documents **user-facing behavior**, not a translation of source code. Images/copyright follow `docs/EXERCISE_MEDIA_LICENSES.md`.

## QA
- Test planned first set → rest → adjustment → pause → resume → Ready → next set.
- Test double-taps with airplane mode and sync retry; one set only.
- Close and reopen the tab during a rest or paused rest; state persists.
- Exit midway then Continue from the Workouts page; first incomplete exercise opens.
- Finish early with some sets; warnings appear. Exit without finishing; session remains active.
- Try finishing without any sets; no XP should be awarded.
- Mobile portrait, RTL, 320px and 390px widths; no keyboard/timer occlusion.

See `COMMUNITY_AND_FOCUS_WORKOUT.md` and `COMPONENT_INVENTORY.md` for the current presentation and API contracts.
