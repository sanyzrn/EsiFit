# Independent validation — audit phase 5 (commerce and privacy)

The supplied notes use main `93c405f`; this review uses `5c6c0f7` with pending phase 1–4 repairs in PR #34. Publication remains on hold until all seven audit reports have been addressed. No live billing, production data mutation or account erasure is authorized by this implementation workflow.

| Finding | Independent verdict before implementation | Repair decision |
|---|---|---|
| F46 | Confirmed: free dataExport=false in both API and UI; plan copy promises export and deletion to everyone, but deletion only shows a toast | Open the existing member export to every member tier, preserve owner scoping and exclude credentials. Correct deletion promises and remove the fake destructive control. Actual irreversible erasure remains a separate unimplemented lifecycle feature, not a pretend demo action |
| F47 | Confirmed: orders are persisted but only checkout's immediate response is exposed | Owner-scoped paginated order history plus a reusable receipt snapshot contract and history in StoreView; preserve legacy receipts |
| F48 | Confirmed: subscriptions have no self-service cancel handler despite the promise | Add explicit immediate cancellation with confirmation, downgrade, notification and clear no-refund/no-auto-renew semantics for the existing mock system; serialize changes on the member row |
| F49 | Confirmed absence of commerce visibility | Add actual order counts, recorded order totals and unexpired active subscriptions to admin overview, clearly labeled as sandbox records. Do not invent real revenue or MRR |
| F50 | Confirmed: neither checkout nor subscribe has a request cap | Use the phase 1 shared PostgreSQL limiter on authenticated validated member writes; retain fail-closed production mock-payment gates |
| F51 | Existing intentional contract: /auth/me returns 200 with user:null, consumed correctly by the application | Document and regression-test rather than change the public session contract |
| F52 | Confirmed: arbitrary strings serialize to unrestricted equipment, silently discarding the old choice | Validate incoming keys with the existing EQUIPMENT_KEYS enum; reject invalid payloads before writes, preserve intentional empty/full selections |
| F53 | Mixed information, not a single defect: the plans GET already includes currency through its spread (the report’s claim of no currency field is inaccurate); IRT is the supported currency, mock paid orders have no real gateway/refund lifecycle, startsAt uses a valid database default | Preserve existing plan currency, expose IRT in receipts, filter unsupported currencies and keep mock labels honest. Do not invent refunds, recurring charges, gateway success or fake financial metrics |

## Positive-claim boundary

The supplied transaction/race claims are not accepted as fresh runtime proof. New tests will cover authoritative pricing, stock rollback/concurrency, cancellation/subscribe concurrency, privacy scoping and production mock-payment denial. The existing export covers fitness history, not every account-domain table; its previous "full personal data/GDPR-style" comment overstates that scope. The repair keeps the current export format compatible and includes owned commerce/account metadata without session tokens or provider credentials. This is not a statement of legal compliance.

## Deferred account deletion

Removing real accounts would cascade through fitness/community/subscription/order data under the existing schema. This phase chooses the report's explicit truthful-copy alternative: no placeholder deletion button or unimplemented SMS promise. A real erasure workflow needs its own reauthentication, retention and role-transition design; no production records are deleted here.

## Implementation and verification

Implemented owner receipt history, free member export, immediate sandbox subscription cancellation, strict equipment keys, shared purchase caps and admin mock-record metrics. Existing stock/pricing guarantees were regression-tested instead of inferred from the report. Subscription changes serialize on the member row; lazy expiry now rechecks under that lock because a stale read could otherwise overwrite a concurrent purchase.

- Complete suite: 314/314 passed in 30 files on disposable PostgreSQL 17.9.
- Phase-5 suite: 13 cases covering ownership, credential exclusion, full-history free export, immutable receipts, cursor ties/legacy JSON, rollback/stock concurrency, subscription/cancel concurrency and stale-expiry downgrade, caps, role boundaries, mock production gates and existing session/currency contracts.
- TypeScript and isolated standalone production build passed. ESLint: zero errors, two existing unused-directive warnings.
- Production HTTP against disposable seeded PostgreSQL passed free export/download headers, receipt history after checkout, purchase → cancel → free entitlements, invalid-equipment rejection and store/plans/settings page responses. A second built production server with mock-payment opt-in disabled denied both purchase routes with 502 and no order/tier mutation. No real payment provider was contacted.
- Real browser visual/mobile/install behavior was not retested; no browser/Lighthouse claim is made.
- No schema change, production migration, account deletion, merge or deployment. Reports 6–7 remain outside this patch.

One intermediate run overlapped Prisma client generation from the build, so an import observed a partially written generated package. After build completion, the complete suite was rerun sequentially and all 314 tests passed; no assertion was weakened.
