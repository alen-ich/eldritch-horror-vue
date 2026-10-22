# Other World inventory restoration prerequisite

## Intent and evidence
Identify and implement the next necessary dependency toward rules-correct encounters, preserving all pre-existing work. This is architectural work with a written specification and plan, self-approved under the user's explicit delegation. No new npm package is needed. Installed versions: Colyseus 0.18.5, SDK 0.18.2, Vitest 3.2.7, Playwright 1.63.0; Node 22.19.0.

The existing private Other World deck cycles resolved cards to its bottom (`continueLocationEncounter`). A pre-existing, untracked discard design describes the eventual correction and remains untouched. Before changing that lifecycle, restoration needs the same physical-inventory protection as live continuation. `GameRoom.applyEngineState` currently validates Spells and Expeditions but accepts missing, duplicate or unknown Other World cards. `otherWorldBindingIsValid` validates inventories only during a pending encounter. This prerequisite closes that independently testable gap first.

## Recommended design and alternatives
Add a pure `validateOtherWorldState(state, content): string | undefined` in `packages/engine/src/other-world-state.ts`, exported by the engine. Validate an initialized deck as an exact permutation of the supplied unique nonempty Other World catalog. Respect existing small synthetic catalogs. No deck is valid for legacy/lobby states only when there is no Other World reveal or pending encounter. No mutation, repair, reshuffle, randomness or framework imports.

For an Other World continuation require a known card on the actual deck top, matching current reveal, existing active owner in Encounter phase, owner location equal to the original Gate location, known Gate at that location, boolean `gateClosed` when present, and a conserved unique Gate inventory. A closed bound Gate must be outside the active zone (discarded or already recycled into an exhausted supply); an open one must be active. Reject an Other World current reveal without its continuation. Completed/last reveals do not constitute an active binding. Gameplay-specific possession and Ancient One guards remain in their existing owner.

Use this validator before live Other World draws, existing continuation binding checks, and all room restoration mutations. A room that already has an initialized deck must reject snapshots stripping it, even if the legacy stateless validator permits absence. No broad global validation of unrelated commands is introduced.

Alternative: implement all encounter-family discards together; rejected because it combines migration, public projection and several family-specific guards. Alternative: duplicate checks in the room; rejected because live and restored validation would drift. The chosen prerequisite leaves bottom cycling explicitly pending, rather than claiming encounter completeness.

## Authority and privacy
The server still derives the actor from the authenticated connection. No new network command, public state or client rule decision. Deck order, pending queue, Gate binding and error details remain server-side; network rejection uses a generic message. The engine depends only on protocol primitives/types. Validation precedes dice and state mutation; rejected input cannot change canonical state or consume deterministic input.

## Acceptance and tests
- Valid full decks, JSON-restored owner decisions, and legacy absent decks remain accepted; validation is read-only.
- Missing/empty/duplicate/unknown/incomplete initialized decks and duplicate/absent catalogs reject.
- Orphan reveals, wrong top/reveal/owner/phase/location/Gate, invalid closure flags and non-conserved Gate zones reject before effects.
- Both direct draw and resumed decisions use the shared check. Ordinary Location/Research continuations remain unaffected.
- Real multiplayer room restoration rejects malformed inventory atomically, preserves exact valid deck order and pending state, and exposes neither deck nor binding to peers.
- Existing multiplayer and all available Playwright suites remain green; run root lint/typecheck/test/build.

## Exclusions, review and next step
No discard/recycle transition, new card effects, readiness promotion, persistence backend or package installation. Existing untracked discard specification and all unrelated changes are preserved. Implementation uses the current directory/branch and scoped commits, with one independent clean-context final reviewer. Next after this prerequisite: physical Other World draw/discard and legacy-continuation migration.

Self-review: scope is one validation boundary; legacy absence differs explicitly from stripping an initialized room; physical Gate closure and privacy are specified; tests cover live and restoration paths. No unresolved requirement. Self-approved for planning.
