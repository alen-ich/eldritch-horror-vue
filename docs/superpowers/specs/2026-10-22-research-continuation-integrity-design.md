# Research continuation inventory and ownership

## Evidence and goal
The draw guard exists. Completion checks the top only after interpreting queued instructions, and applyEngineState validates Other World but not Research. A restored pending Research can therefore consume a choice/random input with a changed top or inconsistent owner. Establish this prerequisite before marker provenance and physical discard.

## Scope and recommended design
Add pure validateResearchContinuationState(state, content): string | undefined. For pending Research only, require encounter phase, selected Ancient One matching the pending deck, existing pending owner matching activePlayerId, currentLocationEncounterCardId matching pending.cardId and exact top identity. Reuse configured physical inventory conservation; legacy partial catalogs remain supported when the optional setup catalog is absent. Reject Other World-only Gate/removed-card metadata on Research. Unrelated pending encounter types remain unchanged.

Call before executeCommand dispatch, randomness and mutations, returning generic ENCOUNTER_CONTENT_MISSING. Call from server applyEngineState before any synchronized/private assignment, throwing a generic restoration error on inconsistency. Server continues to own all rules; protocol and public state remain unchanged and errors expose no IDs. No new dependency.

## Exclusions and alternatives
Do not validate marker provenance, interpreter queues or active test/choice graph in this slice. Decisions can legitimately belong to a colleague (damage prevention), so do not equate pendingDecision.playerId with encounter owner. Investigators can move through effects: do not require current location to match original encounter space. Full replay-based validation is a later alternative with substantially larger scope; waiting until final completion is too late to prevent RNG/effect execution.

## Acceptance
Valid JSON roundtrips preserve continuation. Each wrong top, reveal, phase, owner, Ancient One, missing owner, foreign metadata and configured inventory corruption rejects atomically before RNG. Legacy valid top-bound fixtures pass. Server restoration rejects before state assignment, with two clients retaining identical private/public snapshots. Existing suites and serial Playwright pass.

Self-review: bounded scope, clear privacy and compatibility; approved under delegated review on 2026-10-22.
