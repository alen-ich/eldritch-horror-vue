# Other World inventory integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Track RED→GREEN evidence here.

**Goal:** Reject corrupt Other World physical inventory before restoration or live effects.
**Architecture:** Pure shared state validator; engine draw/binding and room restoration consume it. No new wire fields.
**Tech Stack:** Installed TypeScript, Vitest 3.2.7, Colyseus 0.18.5, SDK 0.18.2, Mocha, Playwright 1.63.0; no new packages.
**Spec:** docs/superpowers/specs/2026-10-22-other-world-integrity-design.md

## Global constraints
Current directory and branch; preserve all pre-existing tracked/untracked changes. Self-approve spec/plan as delegated. Commit only task changes; no push, merge or deploy. No discard correction or family readiness promotion. Server-private validation details must not enter public projection.

## Review focus
Legacy absent deck versus removing a room's initialized deck; malformed runtime arrays; closed Gate still in the active zone; orphan reveal; validator rejects before RNG and before any room field mutation. Each gets a regression below.

### Task 1: Shared engine integrity boundary
Files: create packages/engine/src/other-world-state.ts and packages/engine/test/other-world-state.test.ts; modify packages/engine/src/index.ts.
Interfaces: export validateOtherWorldState(state: GameState, content: GameContent): string | undefined. Reads private deckOrderById['encounter:other_world'], content.otherWorldEncounterIds, currentLocationEncounterCardId, pendingLocationEncounter, players and Gate inventory. No mutation/randomness. Return undefined for valid snapshots, descriptive private error otherwise.

- [x] RED: tests validate full/legacy decks, unchanged JSON round trip, duplicate/unknown/missing/empty/incomplete zones and catalogs, runtime non-arrays, orphan reveal, mismatched top/owner/phase/location/Gate/closure and missing physical Gates. Direct live draw with corrupt inventory rejects without consuming the retained deterministic context; valid retry succeeds. Run `pnpm --filter @eldritch/engine exec vitest run test/other-world-state.test.ts` and observe missing validator/integrity failures.
- [x] GREEN: implement pure validator and export; call before direct draw and from otherWorldBindingIsValid. Keep existing applicability guards. Run focused test plus test/other-world-encounter.test.ts, then engine test/typecheck.

### Task 2: Atomic room restoration
Files: modify apps/server/src/rooms/GameRoom.ts and apps/server/test/GameRoom.test.ts; create apps/server/test/OtherWorldState.test.ts.
Interfaces: registerOtherWorldStateRoomTests(getServer: () => ColyseusTestServer<typeof config>): void, following existing registration pattern. Private applyEngineState validates shared integrity plus initialized-deck removal before changing any field.

- [x] RED: start a real two-client room, reject missing/duplicate/unknown/incomplete deck and orphan reveal with unchanged serialized engine/public state. Valid saved order restores exactly; peers never receive private deck/binding. Run `pnpm --filter server exec mocha -r tsx test/GameRoom.test.ts --exit --timeout 15000 --grep 'Other World inventory restoration'`; observe expected restoration acceptance failure.
- [x] GREEN: add shared validation before room mutations; rerun focused and complete server tests.
- [x] Add docs/architecture/other-world-integrity.md with actual prerequisite scope and remaining discard dependency, preserving existing dirty documentation.

### Task 3: Review, checks and history
- [x] Dispatch one read-only independent clean-context reviewer against spec/plan and task-only diff. Reproduce material findings RED, fix GREEN, rerun affected suites.
- [x] Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; pnpm test:e2e; pnpm exec playwright test --config playwright.norman-action.config.ts; pnpm exec playwright test --config playwright.spell-casting.config.ts. Record actual outcomes and limitations.
- [x] Review task-only diff and git diff --check; stage only task hunks/new files, commit and verify unrelated work remains. Rename chat to describe completed scope.

## Self-review and execution journal
Spec coverage and interface names checked; Task 2 consumes Task 1's exported validator, without protocol or schema changes. Review focus cases assigned above. No unresolved ambiguity. Plan self-approved under explicit user delegation; execute inline.

Ruling: keep this step to integrity validation before the existing discard design — restoration currently accepts corruption, so migrations need a trustworthy boundary first. Cost: bottom cycling remains a documented separate task.
Ruling: preserve baseline snapshots under .superpowers/other-world-integrity and stage only task changes — the working tree already contains extensive unrelated work.

- Task 1 complete: RED 28 failures/1 pass (missing validator and malformed closure admitted); GREEN 517/517 focused, engine 1327/1327, engine/server typecheck exit0.
- Task 2 complete: RED six malformed restorations accepted; GREEN 7/7 real multiplayer restoration tests, exact order and peer privacy preserved.
- Ruling: permit a closed Gate in either discard or replenished supply — the existing immediate Gate recycling test failed with a discard-only constraint; retaining that constraint would break valid continuations. Updated specification; focused suite GREEN.
- Tooling: default pnpm launcher stalled; bundled pnpm 11.25.0 attempted automatic dependency repair and hit a restricted external SQLite store. Used bundled pnpm with pnpm_config_verify_deps_before_run=false, preserving installed dependencies. Direct Node test runners provided initial RED evidence. Local socket tests require expanded execution permissions; their unexpanded attempt failed on fetch before assertions.

- Final review: one independent clean-context reviewer (gpt-6-astra) found P2 sparse-array conservation bypass. Reproduced RED (1 failed/30 passed); fixed by inspecting every slot via Array.from. Added sparse deck/catalog validation and live-execution assertions, sparse room restoration, successful retry with retained RNG, and real two-peer pending/closed-Gate restoration/privacy coverage. No deferred findings.
- Final checks: pnpm lint/typecheck/test/build exit0 (final output in .superpowers/other-world-integrity/*-final.log); engine1329, content127, protocol21, server288 passing. Playwright default7/7, Norman2/2, Spell2/2 exit0. Existing Turbo output-cache and FORCE_COLOR warnings remain non-failing.
- Ruling: use a new architecture status document instead of editing the already-dirty token-encounter overview — preserves unrelated documentation hunks while recording the exact remaining dependency; discovery is through this plan and its spec.
- History: stage new task files and reconstruct only this task's three integration changes against HEAD; verify the remaining working-tree delta matches the saved pre-task snapshots. Current master branch retained as explicitly requested; no push/merge/deploy.

- Final browser rerun after the review fix: default7/7, Norman2/2, Spell2/2, each exit0. Default pnpm eventually reported DNS failure resolving pinned10.28.0; successful checks used bundled11.25.0 against unchanged installed dependencies, with automatic dependency repair disabled. Scoped Git index contains9 files and352 additions; unrelated pre-task changes remain outside it.
