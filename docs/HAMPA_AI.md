# همپا — role-aware EsiFit assistant

## Setup and product behavior

Admin → هوش مصنوعی (or `/admin?tab=ai`): add Gemini or Custom, enter a key privately, select a model, and use **آزمایش و ذخیره**. Saving performs an actual SDK completion with a required function call. HTTP 200 or a prose “OK” is insufficient. The key, URL and model are tested together on every save. A failed test preserves the saved configuration. Existing keys can be retained during edits; keys cannot be read back. Deactivate a connection to stop all its grants while preserving accounting/history.

Gemini uses native Google JSON and `x-goog-api-key`. Its optional gateway accepts a root, `/v1beta`, or `/v1beta/models`; gateway path prefixes survive normalization. Custom uses OpenAI-compatible Chat Completions and bearer authentication, accepting a base URL or full `/chat/completions` URL. Both require a public HTTPS endpoint. This ports the protocol/address behavior reviewed in `sanyzrn/DbsNex` at `6a653a3620c18e68af37fdf3bcce3c7d78ae052a`, `packages/ai/lib/src/cloud/ai_provider.dart` and the “Gemini through a gateway” tests in `capability_check_test.dart`. EsiFit uses the version-matched AI SDK (rather than copying Flutter code).

No credentials are shipped or seeded. The administrator supplies and tests their own connection. Wire fixtures test both protocols without real credentials; those are not evidence of a live Google account working.

Give each coach/athlete an explicit grant, connection, daily message limit and monthly message limit. Grants are independent of athlete subscriptions. Zero limits or disabled grants deny access. Connection/grant changes do not reset use. Administrators use active connections with a bounded 200/day, 5000/month allowance. Usage includes successful turns and live five-minute reservations; failures release slots. A per-user Postgres transaction advisory lock serializes claims across server instances, checking both calendar windows in the user's timezone. Weekly AI recap uses the same grant, provider and accounting; deterministic recap remains its fallback.

`/ai` is available in all three role navigation models, including mobile. It has role-specific starter prompts, connection selection for admins, quota display and private, reloadable history (last 60 messages per selected conversation; newest 30 conversations). Role changes hide previous-role conversations. Failed model turns are marked and excluded from future model history.

## Role and action boundary

The server builds HamPa's role, site context, domain restriction and health instructions. The model cannot grant itself a role. Member tools read only the actor's profile, latest measurements/targets, active goals/plans, recent workouts/nutrition/readiness and the exercise library. Meal context includes food names, serving sizes and macronutrients; plan context is bounded to the first seven days. Coach reads additionally require an active roster link and active athlete. Admin reads match the manual console. User-authored names, notes and community content are untrusted data.

| Manual panel capability | Assistant capability |
| --- | --- |
| Admin overview / account search | Read real data with bounded output |
| Role, tier, suspension | Propose `update_user`; existing manual handler retains subscription and account guards |
| Primary human/virtual coach assignment | Propose `assign_coach`; uses existing assignment handler |
| Remove post/comment, notify author | Propose `moderate`; uses existing moderation handler |
| AI grants and limits | Propose `grant_ai`; uses the same validated admin endpoint |
| Stop an AI connection | Propose `disable_provider` |
| Add/edit provider URL, model, credentials | Private admin form with mandatory live probe; secrets never go into model context |
| Coach assign template and note | Propose `assign_plan`; active own roster only; existing assignment/notification handler |

Like Nex, reads execute immediately but writes are only **proposals**. At most three proposals per turn. The server builds the preview from current records and stores actor ID/role, conversation, request ID, payload, a target-state fingerprint, 15-minute expiry and status. Human confirmation uses an authenticated endpoint, rechecks the grant/role/roster and fingerprint, then atomically claims the proposal before invoking the existing manual handler in the same Next request context. The client cannot substitute a payload at confirmation. Cancellation, expiry and cross-user confirmations cannot mutate data. Account self-edit/admin promotion remain forbidden. Repeated confirmation cannot execute a second mutation.

The action log is visible in admin. An interrupted action remains `executing`, and a handler failure is `failed`; inspect the real panel before proposing again. These statuses are deliberately not retried automatically: a handler may have completed some side effects before an interruption. This is at-most-once execution, not a claim of distributed exactly-once transactions.

## Storage and release

`AiProvider`, `AiGrant`, `AiAction` are additive Prisma tables. Apply `docs/migrations/20261024_hampa.sql` with the existing application schema on the search path (`esifit` in production). RLS is enabled and Supabase client/PUBLIC table privileges revoked; no client policies exist. Only the server database role accesses them.

Keys use AES-256-GCM with a fresh nonce, authenticated ciphertext and a domain-separated key derived from `AI_ENCRYPTION_SECRET` (optional) or the existing server session secret. Keep the chosen secret stable; rotating it requires re-entering provider keys. Do not put an encryption secret in a public env variable. Keys are excluded from settings responses, tool results and error messages. All provider requests reject redirects and other origins; DNS is checked at socket connection time and non-public addresses are rejected (including mapped IPv4). Responses, output tokens, steps and total duration are bounded. No arbitrary HTTP, SQL, shell or browser tool is exposed.

Existing virtual `AiCoachEnrollment` remains a reserved coach-assignment concept; assigning the virtual coach does not silently create a paid AI grant or replace an athlete's plan. HamPa chat is activated by the explicit grant above.

The CI suite exercises real disposable PostgreSQL for permission, history, quota concurrency, action binding/expiry/replay and existing role/community regressions. Provider contract fixtures cover both headers, URLs and function-call responses. Run `npm run build` and the essential CI suite before merging. Apply the additive SQL and intentionally release the final main commit once; automatic Vercel Git deployments stay disabled.
