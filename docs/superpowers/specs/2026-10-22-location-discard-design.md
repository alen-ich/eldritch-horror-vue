# Physical Location draw, discard and recycling

## Goal and rules
Replace bottom-cycling for general/america/europe/asia_australia with physical card zones. Rule provenance is the repository's verified Reference Guide pages5–6, recorded in the Expedition discard spec. No printed effects change.

## Architecture and scope
Keep private undrawn order in deckOrderById, one private pendingLocationEncounter with cardRemovedFromDeck, and public locationDiscardIdsByDeck (partial record of four arrays). Removing the last undrawn card immediately shuffles prior discards for that family and clears its pile; the active card is excluded. Completion, including lethal/game-end interruption, discards once and clears binding/reveal. Singleton partial fixtures recycle at completion. Per-family inventories are disjoint.
Add optional server-only locationEncounterSetup catalog to GameContent, configured with the full scanned36-card production catalog independently of executable sections. Validate it with existing four-deck setup helper, no hardcoded count. Initialized configured decks conserve every catalog identity exactly once across undrawn/discard/removed active zones. Optional uninitialized legacy snapshots remain absent. Reject stripping an initialized deck on room restoration. Partial fixtures without physical catalog allow unique nonempty canonical regional IDs or same-family fixture catalog IDs; no full-count assertion. Never repair corruption.
Legacy full decks without discard use empty piles; legacy top-bound continuation migrates once on a cloned transition. A top-bound pending card may coexist with disjoint prior discards because that is also the new draw pre-removal state. Existing Location transaction covers draw/removal/recycle/effects/resume and rolls back retained deterministic input on failure. Shuffle output must exactly conserve supplied identities and is copied.
Server projection synchronizes JSON discard record only; engine projection copies nested arrays; client exposes readonly data and clears on attachment/replacement. Remaining order and removed flag never synchronize. Existing command input validation and authority unchanged; no new commands/buttons or client rule outcomes.

## Alternatives and exclusions
Only changing completion would leave active identity duplicated and delay last-card recycling. A shared universal deck framework would spread this change across already-tested families. Follow their focused pure helper pattern instead. No new packages, token marker logic, printed effects, full readiness promotion or broader refactor.

## Acceptance and tests
Four-family deterministic entire-deck recycle conserves identities and excludes active card. JSON resume, legacy migration, singleton and lethal completion discard once. Malformed/sparse/duplicate/cross-family/missing inventories and shuffle output reject atomically without private IDs. Partial random exhaustion rolls back input. Real two-peer restore/reconnect preserves public discard and private binding, rejects corruption before mutation and hides remaining order. Client replacement resets public discard. Root lint/typecheck/test/build and three serial Playwright configurations pass.

## Self-review
Scope, authority, privacy, legacy migration and exact-once lifecycle checked; self-approved per explicit user delegation. Dependencies installed already suffice (Colyseus0.18.5, Schema5.0.32, Vitest3.2.7). Current branch, no worktree. Dirty-file changes saved as precise already-applied patches and never staged wholesale.
