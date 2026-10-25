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

## Audit phases 6–7
- Reused ThemeToggle in public/mobile/sidebar/auth chrome, preserving dark default and persistent light choice.
- One root skip link targets focusable main#main-content across public/app/offline/404 shells. Persian not-found reuses the shell, BrandMark and Button.
- StoreView accepts initialCatalog: Catalog|null; SSR/API share live catalog query/DTO with explicit failure, retry, loading and empty states.
- AuthCard/OnboardingFlow accept validated returnTo; member/staff page guards preserve destinations and live-workout query values.
- Shared useReducedMotion uses a consistent hydration snapshot in all animated consumers. Dashboard time also starts consistently; DayFlow preserves full text contrast.
- Wide social card uses approved logo, existing palette/Lalezar/Vazirmatn and an optional browser renderer.
- Existing API writes share bounded JSON parsing with explicit 413 response; no parallel UI primitives or runtime browser dependency.

- PageHeader and BrandMark were moved, not duplicated, into presentation-only files. Existing exports remain compatible. PublicPageShell is server-rendered so anonymous pages no longer import the authenticated shell/offline/navigation through its client graph. Vazirmatn weights load on demand; the main display face retains preload. This targets measured public-page critical-path cost without caching private HTML.

- Landing Tile now instantiates decorative motion studies only near the viewport; titles/descriptions remain SSR content and visual space stays reserved. ThemeToggle uses existing CSS button feedback instead of importing a motion engine solely for its icon.

## Theme, navigation and loading polish — 2026-10-25
- `BrandLogo({ size=42, className? })`: extracted the existing non-interactive logo Image from BrandMark. BrandMark retains its existing homepage link; no duplicate logo paths.
- `BrandLoader({ label='در حال آماده‌سازی…', className? })`: accessible status, shared approved logo, theme tokens, reduced-motion-aware CSS. Shared `layout/route-loading.tsx` supplies a focusable main for private routes; WorkoutLiveGate reuses it inside the existing main during real session preparation.
- `SheetContent`: optional `showCloseButton=true`; standard dismiss is a labeled 44px target at logical inline-end. MobileBottomNav opts out and supplies a full-width SheetClose action after navigation links, preserving keyboard/backdrop dismissal and focus restoration.
- `PageHeader`/`MemberBackBar`: right-pointing back chevron in RTL; mirrored in LTR only.
- `LandingHero`: server-rendered dark/light photographic treatments, one CSS-selected transparent local portrait and an accessible image label. Layout/copy/actions stay shared. Light photo has neutral studio lighting instead of the dark variant's orange rim.
- No schema, flags, API behavior or dependencies changed.

- Branded route suspense is scoped to authenticated/auth flows, not the root layout. Public pages retain visible server-rendered content when JavaScript is disabled; no global fallback hides the catalog/landing page.

## Coach/catalog/engagement revision — 2026-10-25
- `ProgramEditor({ athleteId, activePlan, catalog, equipment })`: shared UI primitives, eight starting presets, current-plan copy, seven-day editable review, bounded prescriptions, equipment validation, concurrency baseline, confirmation/loading/error/success. One presentation family; no parallel inputs/modals.
- `CoachNote({ athleteId, initialNote })`: independent private note save/clear, pending/error/status. Keyed by athlete to prevent stale state crossing profiles.
- `CoachWorkspaceView`: normalized name search and all/attention/no-program filters; existing roster aggregate/cards retained.
- `AthleteDetailView`: active prescription disclosure, profile/nutrition/readiness review, ProgramEditor and CoachNote only for the assigned coach; administrators retain read-only supervision.
- `InstallPrompt`: one root listener and nonmodal promotion; browser eligibility, visible engagement, critical-flow suppression, cooldown and approved BrandLogo. Native prompt is triggered only by its button.
- `PublicPageShell`/landing: signed-in footer and acquisition demos/CTA hidden; role-aware useful continuation links, published education retained.
- `ExerciseVisual`: all 100 canonical IDs mapped, source-specific credit, 96 reviewed RepDB visuals plus four independent schematics. Error/offline compact states retain consistent geometry rather than disappearing.
- Foods: 140 catalog entries including 46 record-linked USDA additions; normalized half-space/Arabic-keyboard search and serving/provenance labels.
- No dependencies, entities, fields or feature flags added. Existing WorkoutPlan, WorkoutPlanDay, PlannedExercise, CoachClient and UserProfile are reused.

## Focused content/subscription follow-up — 2026-10-25
- Signed-in landing restores the shared hero and FeatureBento; role-correct continuation, day demo/sign-up CTA/footer remain suppressed.
- PlansView distinguishes load errors from an unconfigured catalog, retries in place, and shows unavailable payment as coming soon. API validates feature strings defensively; role-based subscription policy is unchanged.
- Eight original editorial articles with linked primary sources, a clearly identified editorial author and five category routes; unfilled stories and disabled magazine show coming-soon states. No new UI family, flag or schema.

## Independent planning and HamPa operations
- TrainingPlanner({athleteId?,staff?}): shared onboarding/member/coach/admin preview, actual profile summary, independent quota, consent/revocation, durable request recovery, source labels, seven-day details, human review and explicit activation dialog; loading/offline/error/empty/review/applied states. Existing Button/Textarea/AlertDialog/Icon tokens.
- PlanningSettings: independent provider policy, daily/monthly caps, recent requests and refresh/error states within the existing admin AI tab. Credentials remain in the existing tested provider form.
- OnboardingFlow: four profile steps (identity/body/goal/schedule and limitations), edit-prefill, then shared planning review; saving a profile never silently archives a program.
- HamPa: role-specific reports/catalog edits with trusted confirmation previews; offline unsent-message preservation in current view, opaque request recovery per account, and no automatic duplicate provider requests. No new component family or package dependency.
- HamPa chat focus: compact toolbar, collapsed conversation/provider/quota controls, explicit “فقط چت”/exit toggle, automatic focus on mobile composer entry. AppShell focus context hides navigation without remounting the conversation. VisualViewport sizing keeps the composer above mobile keyboards; Escape exits, dialog confirmations remain available, and scroll locking/listeners are restored on exit/unmount. Offline/error/recovery states remain visible in focused chat.
