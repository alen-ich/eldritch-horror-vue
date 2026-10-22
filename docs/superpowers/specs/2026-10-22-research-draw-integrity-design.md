# Research draw inventory integrity

## Goal and evidence
The physical Research setup exists, but resolveResearchEncounter checks only the top card. Before new Research effects or discard support, configured physical decks must conserve the selected Ancient One's eight cards before a draw. Existing dirty changes are outside this iteration and must remain uncommitted.

## Scope and architecture
Add a pure TypeScript preflight, called by resolveResearchEncounter before instruction binding and randomness. When GameContent.researchEncounterSetup is supplied, validate the full canonical 32-card catalog and require the selected private order to contain exactly its eight distinct physical IDs. Reject malformed, sparse, duplicate, foreign, cross-deck, missing and extra inventory with ENCOUNTER_CONTENT_MISSING. Do not repair, skip or reveal cards. Callers without this optional catalog retain their legacy fixture behavior, including ENCOUNTER_DECK_MISSING.

The server remains authoritative; the client sends only its existing Research intent. No protocol, public projection, transport, dependency package or UI changes. Error text is generic and never contains private IDs/order. Rejection must leave caller state and deterministic input untouched.

## Alternatives
Recommended: scoped pre-draw conservation guard, reusing the configured physical catalog. Validating only the top misses corruption below it. A comprehensive restored-continuation validator is useful later but requires binding marker provenance and active instruction/test checkpoints; it is deliberately excluded here. Physical discard/recycle and new card transcriptions are also excluded. No family readiness promotion.

## Acceptance and tests
Engine regressions: all four Ancient Ones, valid reordered decks, corrupt order classes, corrupt catalog, unsupported actual top, unchanged state and zero random consumption, legacy fixture compatibility. Existing two-client Research setup and multiplayer suites must continue to pass. Run lint, typecheck, test, build and Playwright; report environmental blockers accurately.

## Review
Self-review: no placeholders, scope and compatibility explicit, privacy preserved. Approved under the user's delegated specification approval on 2026-10-22.
