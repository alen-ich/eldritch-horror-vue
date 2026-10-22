# Expedition array integrity

## Intent and evidence
The next prerequisite for executable Expeditions is trustworthy physical inventory. The existing implementation has setup, private draw binding and public discard/recycling, but deliberately exposes no live Expedition command. Its catalog and shuffle validators use sparse-skipping array predicates: a single missing slot can pass the count and uniqueness checks. Research setup already uses Array.from before checking entries.

## Design
Require a dense collection of all 18 canonical cards at catalog and shuffle boundaries. Reject a catalog with any absent entry before START_GAME consumes randomness. Reject an invalid shuffle result through the existing RANDOM_INPUT_REQUIRED transaction; preserve source state and checkpoint rollback. Keep existing exported signatures and pure engine ownership. No wire fields, client rules, hidden-data projection or new dependencies change.

Recommended: inspect every array slot using Array.from and existing canonical membership checks. Alternative: enumerate all canonical IDs to prove membership; valid but larger than this boundary repair. JSON normalization is unsuitable because it changes input and disguises malformed values. Existing state conservation validation spreads zones and already visits missing slots; retain it.

## Scope and acceptance
Tests cover sparse catalog, explicit undefined entry, sparse shuffled output, duplicated/foreign shuffled output and valid reversed output. START_GAME rejects invalid catalog without shuffle or mutation; failed shuffle preserves state and deterministic checkpoint. Full engine, real multiplayer server and existing Playwright regressions pass. No effects, encounter-family recycling rewrite, framework APIs or readiness claim are included.

## Review and approval
Self-reviewed for scope, ambiguity, privacy and interface consistency. Approved under the user's explicit delegation; execute inline in the current branch. Preserve pre-existing dirty files and commit only this iteration's additions/patches. Implementation status: pending RED reproduction.
