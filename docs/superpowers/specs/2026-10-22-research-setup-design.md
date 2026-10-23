# Physical Research setup catalog

## Intent and verified gap
The next physical-lifecycle prerequisite is separating Research inventory from executable effects. Production START_GAME builds Research from researchEncounters, containing only eight Azathoth and eight Cthulhu rule records. The authoritative scanned catalog already contains all32 physical Research fronts (eight per Ancient One). Shub-Niggurath and Yog-Sothoth consequently have no Research deck. Catalog availability must not depend on transcription/readiness.

## Architecture and scope
Add optional GameContent.researchEncounterSetup: readonly ResearchSetupCard[] ({id:string,deck:ResearchEncounterDeckId}). A pure research-setup.ts owns strict full32 canonical ID/deck validation and selected-deck initialization. Production passes scanned family=research records. Validate the configured physical catalog before setup randomness; shuffle only the selected Ancient One's eight IDs and validate the output conserves that exact set. Keep undrawn order server-private. No draw occurs during setup.

Use existing checkpoint pattern for START_GAME with the physical catalog, composing naturally with Expedition/starting Spell setup. Reuse a setup-specific transaction wrapper with generic RANDOM_INPUT_REQUIRED error. Legacy callers omitting this optional field retain existing rule-derived setup, preserving older fixture/API compatibility. A supplied malformed catalog must never silently fall back.

## Alternatives
Recommended explicit optional physical catalog mirrors Other World's separate ID inventory and Expedition setup metadata. Adding unsupported rule records for24 currently missing card sections invents effects and wrongly couples readiness to inventory. Importing content into engine breaks the pure engine boundary. No npm dependency is needed.

## Authority and privacy
Server selects content and supplies random input. Client sends existing START_GAME intent only. No new commands, Schema fields or UI change. IDs are known public fronts, but shuffled deck order stays private. Unsupported actual tops still reject ENCOUNTER_UNSUPPORTED without searching ahead or consuming effects. No family readiness/full-game completeness claim.

## Acceptance and tests
All four selections initialize exactly their eight canonical cards even if no executable Research rules exist. Deterministic reverse shuffle controls actual top; no other Research decks are initialized. Missing/duplicate/foreign/wrong-deck/sparse metadata rejects before any random use and mutation. Invalid shuffle output rejects with retained deterministic input rolled back. Legacy absence retains prior setup. Two connected clients cannot observe physical order; valid JSON restoration retains order. Root checks, multiplayer tests and all Playwright configurations pass.

## Exclusions and review
No Research inventory restoration validation, physical discard/recycle migration, new card effects, transcription or private origin-marker binding. Those follow this catalog prerequisite. Current directory/branch and unrelated changes preserved; no commit/push/merge/deploy. Self-reviewed and self-approved under explicit user delegation; exact counts/IDs come from existing validated catalog.
