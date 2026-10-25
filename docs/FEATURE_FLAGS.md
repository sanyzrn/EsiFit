# Engagement feature flags

The executable registry is `src/lib/feature-flags/registry.ts`; the server resolves it and supplies the same values to UI components.

| Flag | Default | Behavior |
|---|---|---|
| CHALLENGES | off | Hide the incomplete competition tab; GET returns an empty disabled result and member joins are rejected at the API |
| PRIVATE_CHALLENGES | off | Depends on CHALLENGES; private records stay hidden and private joins are rejected when disabled |

These existing flags were changed by the phase-4 audit repair. Challenge score calculation, invitation creation/validation, settlement and winner rewards remain unimplemented. Preserve their records and keep the flags off in production. An explicit environment override can enable the legacy endpoints for development diagnostics; it is not a completed competition feature. Random seed participant scores were removed. No other flag defaults change in this phase.

## Independent planning rollout
`AI_PLANNING` depends only on WORKOUTS and defaults on; it is separate from AI_CHAT/AI_INSIGHTS. The server-side AiPlanningPolicy still defaults disabled until an administrator selects an existing tested connection. Disabling the feature blocks generation/activation while existing plans remain intact. Human review requests and own-history reads remain authorized independently.
