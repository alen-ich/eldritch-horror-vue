# Reject orphan Research reveals

## Goal and evidence
The next small prerequisite for reliable Research continuation/restoration is rejecting a revealed current Research card without a Research continuation. Existing validateResearchContinuationState returns early for absent or non-Research pending state, even when currentLocationEncounterCardId reveals a Research card. Normal completion clears current and pending together. Room restoration and executeCommand already call this validator before mutation/dispatch.

## Design and alternatives
Extend the existing pure validator: when no Research continuation exists, reject a current ID beginning encounter_research_; otherwise keep accepting unrelated encounter families and completed lastLocationEncounterCardId. Prefer the existing validator over a new room-only check so direct engine callers share the invariant. Silently clearing the revealed card would repair corrupted snapshots and hide the problem; reject instead.

## Scope, authority and privacy
No new dependencies, command, protocol/Schema field, card effect or discard/recycle migration. Server remains authoritative. Rejection text must not include the hidden/revealed ID. Return ENCOUNTER_CONTENT_MISSING through the existing command boundary without mutation/version/RNG consumption. Existing legacy partial Research fixtures remain supported. A non-Research continuation with a Research current reveal is inconsistent too; valid other-family current/pending pairs remain accepted.

## Acceptance and tests
RED/GREEN orphan reveal with no pending; Research reveal paired with generic pending; no reveal/no pending; completed last Research reveal; genuine non-Research pair. Corrupted commands reject before deterministic die consumption, preserve source, and expose generic errors. Real two-client room restoration must reject without changing the last valid snapshot. Run full baseline, server and three Playwright configurations.

Self-review: focused single invariant, no invented game rule, signatures unchanged. Approved under user delegation; inline current branch. This spec supersedes no prior inventory or continuation policy.
