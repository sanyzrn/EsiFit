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
