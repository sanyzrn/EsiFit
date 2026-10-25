# EsiFit — maintained component contracts

Updated 2026-10-24. These are actual specifications for components extended by
the community/focus-workout revision. Reuse the existing UI primitives in
`src/components/ui`; no parallel button, sheet, card or timer family is introduced.

| Component | API / variants | States and behavior |
| --- | --- | --- |
| `LandingHero` | `{ signedIn: boolean }` | Existing merged athlete hero retained unchanged; server-rendered local WebP, responsive copy and actions |
| `MobileBottomNav` | Role/feature-aware navigation from `useMemberNav()` | Member: Home / Workout / Nutrition / Community / More; extra destinations use existing accessible Sheet; coach/admin keep their separate navigation |
| `CommunityView` | `{ signedIn: boolean }` | All / Mine feed, cursor pagination, composer, refresh, loading/error/retry/empty, optimistic serialized reactions, optional CHALLENGES tab |
| `PostCard` (inside CommunityView) | `post, signedIn, likePending, onLike, onDelete, onCommentCount` | Text, author, timestamp, like, expandable paged comments, comment composer, native sharing/text clipboard, owner-only deletion with AlertDialog confirmation |
| `ExerciseVisual` | `slug, name, compact?, autoPlay?, playing?, immersive?, instructions?, className?` | Existing exact-ID media; static compact preview; start/finish playback at 0.5/1/1.5×; manual frame toggle; pause/reduced-motion; canonical text fallback and image retry; attribution retained |
| `WorkoutSessionHUD` | `{ initialSession: LiveSession }` | Default focus canvas, detailed view, active-set clock, shared capture form in Sheet, offline-first set recording, fullscreen rest/next preview, existing swap/picker/finish flows |
| `useActiveSetClock` | `(storageKey, enabled)` → `seconds, paused, toggle` | Wall-clock count-up; explicit pause; persisted active exercise/set; stops during capture/rest/completion; deletes the previous set's clock when moving on |
| `Icon` | Existing registry extended | Adds Play, Pause, List, Maximize2, Share2; existing SendHorizontal reused |

No new data entities, database fields, feature flags or package dependencies.
Community response contracts live in `src/features/community/types.ts`.
Existing live exercise DTOs now include optional `instructions`, sourced from the
existing `Exercise.instructionsFa` field. Add/swap responses retain equipment.

## HamPa AI (2026-10-24)
- `features/admin/ai-management-tab.tsx`: connection probe/save, private credential edit, paged per-user grants/usage, action audit.
- `features/ai/ai-assistant-view.tsx`: role-aware chat, history, quotas and reviewed action cards; reuses shared alert dialog and shell.
- `lib/ai/{provider-config,provider,transport,secrets,access,quota,prompt,actions,athlete-context,tool-contracts}.ts`: canonical provider, role and execution boundary. See `docs/HAMPA_AI.md` before extending tools.

## Audit phases 1–3 (2026-10-25)
- `WorkoutSessionHUD`: existing capture form includes a labeled warmup checkbox, persisted in the same offline set payload; resumed sets preserve classification. Warmups do not advance prescribed working-set progress.
- Auth response: `needsOnboarding` names the existing routing behavior; `isNewUser` remains a compatibility alias.
- Added server-only `RateLimitBucket` (hashed key/count/expiry); no feature flags or new UI primitives.

## Audit phase 4 (2026-10-25)
- `AchievementsView`: existing mission cards now identify their period; outstanding completed historical periods remain claimable. Claims are keyed by mission and period, with existing loading/toast/error handling retained.
- `WorkoutSessionHUD`: completion waits for all queued sets from its own session. Transient failures keep it open. Terminal rejections show a separate explicit action to finish only the saved sets; rejected local records remain preserved.
- Existing challenge tab is hidden by the server-resolved CHALLENGES flag, default off until scoring/settlement is implemented.
- Shared `activity-streak` helpers provide current and longest calendar-day streaks; no new visual components or database entities.

## Audit phase 5 (2026-10-25)
- `StoreView`: owner order history in the shared Sheet, loading/error/retry/empty states, stable cursor pagination, immutable receipt item names/prices and totals. Legacy receipts retain their original recorded totals.
- `PlansView`: current subscription and end date, immediate cancellation through the shared AlertDialog, disabled pending controls and refreshed session/tier. Current billing is explicitly mock and has no automatic renewal or refunds.
- `SettingsView`: export available to every member tier, pending download state; truthful unavailable account-deletion copy replaces the fake destructive button. No erasure endpoint exists.
- `AdminConsoleView`: actual recorded mock order count/total for 30 local calendar days and active subscription count; these are not gateway revenue or MRR.
- No new UI primitives, dependencies, feature flags or schema fields.
