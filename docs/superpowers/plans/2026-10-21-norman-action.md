# Norman Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Execute Norman's monster-discard action with physical Clue payment and shared once-per-round Sanity substitution.

**Architecture:** Atomic typed intent; pure engine module owns payment/target validation and removal. Existing command guards, room projection and action completion remain authoritative. UI selects public targets and payment only.

**Tech Stack:** Existing TypeScript, Zod, Vitest, Colyseus 0.18, Vue/Nuxt and Playwright; no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-21-norman-action-design.md`.

## Global Constraints

- Work in current directory/branch; no worktree, commit, push, merge or deploy.
- Cost: 2 physical Clues OR 1 physical Clue and 1 Sanity; never last Sanity.
- One shared private Norman substitution per round, including Feed the Mind rerolls.
- No private ledger, pool order, physical Clue IDs or Spell backs sent to browser.
- Preserve unrelated `.superpowers/`; execution ledger is below.

## Review Focus

- Forged counts/duplicates across physical Clue zones reject atomically (Task 2).
- Stale Gate/Monster and Epic target reject before payment (Tasks 2/3).
- Action and Spell payments share ledger even across restore and round transition (Tasks 2/3).
- Invalid/throwing shuffle rejects without state or RNG consumption (Task 2).
- UI reload/replay cannot pay twice or send another player's identity (Tasks 3/4).

### Task 1: Strict intent

**Files:** `packages/protocol/src/index.ts`, `packages/protocol/test/protocol.test.ts`.

**Interfaces:** `USE_INVESTIGATOR_ACTION` gains optional `monsterInstanceId: string` (1–128 chars), `useSanity: boolean`; existing empty intent accepted. `GameEvent` gains `{type: "INVESTIGATOR_ACTION_PAID"; playerId: string; cluesSpent: number; sanitySpent: number}`.

- [x] RED: schema accepts target + either boolean; rejects empty/oversized target, nonboolean payment, unknown fields, spoofed playerId and amount.
- [x] Run `pnpm --filter @eldritch/protocol test` and see new accepted-payload assertions fail.
- [x] GREEN: extend strict schema and event union; rerun protocol suite.

### Task 2: Atomic action and shared usage

**Files:** create `packages/engine/src/norman-action.ts`, `packages/engine/test/norman-action.test.ts`; modify `packages/engine/src/norman-clue-substitution.ts`, `packages/engine/src/index.ts`.

**Interfaces:** `resolveNormanAction(state: GameState, playerId: string, command: Extract<GameCommand,{type:"USE_INVESTIGATOR_ACTION"}>, content: GameContent, context: EngineContext): CommandResult` is version/action-neutral. `spendNormanClueSubstitution(state: GameState, playerId: string): boolean` initializes genuine legacy ledger then charges one Sanity and shared usage. Existing `spendNormanSpellReroll` keeps its pending-cast checks and delegates. `withNormanActionRandomTransaction(context, run): CommandResult` checkpoints and returns existing MONSTER_CONTENT_MISSING on invalid RNG.

- [x] RED: tests invoke executeCommand for both prices, remote target, active Gate, Epic refusal, no Gate, missing content/pools, invalid Clue zones/counts, two matching monster kinds, setAside, invalid shuffle and deterministic rollback. Assert original input unchanged, one version/action, exact resource/token effects, no victory rewards, shared ledger both payment orders, last Sanity and round reset.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/norman-action.test.ts`; expect supported-action failures.
- [x] GREEN: implement module; validate physical Clues across all known clue zones, selected Monster count against pool and board, Gate definition and target. Return clone only on success, validate shuffle multiset before assigning. Keep setAside reserve separate. Integrate before Jim/Trish, reject supplied Norman fields for other investigators, wrap Norman command with RNG checkpoint in executeCommand.
- [x] Run focused action and existing Norman Spell tests; run engine suite. No broader refactor.

### Task 3: Multiplayer ownership and restoration

**Files:** create `apps/server/test/NormanAction.test.ts`; register in `apps/server/test/GameRoom.test.ts`. Existing GameRoom adapter supplies crypto context for investigator commands, so production changes only if tests expose a required gap.

**Interfaces:** export `registerNormanActionRoomTests(getServer: () => ColyseusTestServer<typeof config>): void`; use existing private test snapshot adapter.

- [x] Integration cases: real two-client tests assert authoritative action, stale/replayed version, guest rejection, malformed payload, restore retains shared usage, independent room unaffected, public schema excludes private zones.
- [x] Run server tests; no production adjustment required. Existing core implementation made integration cases green immediately; these are integration verification, not a claimed new RED.
- [x] GREEN: use existing room context/projection; fix only demonstrated integration gaps and rerun suite.

### Task 4: UI and browser journey

**Files:** modify `apps/web/app/components/InvestigatorActionPanel.vue`; create `apps/server/test/fixtures/norman-action-server.ts`, `playwright.norman-action.config.ts`, `tests/e2e/norman-action.spec.ts`; update `playwright.config.ts` to exclude isolated fixture journey.

**Interfaces:** existing `game.monsters`, `activeGateIds` and safe public content map targets; local select field `Monster at a Gate`, payment buttons `Spend 2 Clues: discard Monster` and `Spend 1 Clue and 1 Sanity: discard Monster`. Send only atomic USE_INVESTIGATOR_ACTION. Retain Jim/Trish flow.

- [x] RED: isolated two-browser fixture puts Norman away from a target Gate with 2 physical Clues and another target retained. Assert action controls exist, first price leaves Sanity/ability, second price spends exactly one of each, reload preserves action charge and repeat is disabled. Parametrize both prices on fresh rooms. Assert private fields absent from rendered HTML. Observer removal is covered in Task 3.
- [x] Run `pnpm exec playwright test --config playwright.norman-action.config.ts`; expect missing controls.
- [x] GREEN: implement target and payment controls, reset invalid selection reactively, disable outside active action or insufficient public resources; server decides ledger availability. Run new browser tests and production starting-spell regression.

### Task 5: Review, documentation and verification

**Files:** `docs/rules/base-game-investigators.md`, `docs/project-owner-guide.md`, `docs/exec-plans/base-game-rules-implementation.md`, this ledger.

- [x] Update scope: Norman action and two substitution contexts execute; all other unsupported abilities unchanged.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, targeted Playwright and `pnpm --filter server exec tsx scripts/verify-spell-back-privacy.ts`. Inspect actual exits/output; record blockers.
- [x] Dispatch one clean-context reviewer with spec, plan and current diff (no implementation history). Reproduce substantial findings with failing tests, fix, rerun focused/full checks as warranted.
- [x] Final diff/status inspection; report evidence and limitations, no commits.

## Self-review and approval

Spec coverage and exact interfaces checked; no new synchronization field needed. Shared ledger already has round-reset and snapshot marker. All five review risks have assigned tests. Plan self-approved under the user's explicit authorization; execute inline.

## Execution ledger

- Pre-flight: initial tracked worktree clean at `9c16ea6`; unrelated `.superpowers/` present and preserved. Previous pnpm launcher cannot resolve registry. Located cached pnpm 10.28.0 executable and started offline frozen install to restore missing node_modules. No package/lockfile changes intended.
- Ruling: record execution directly here instead of skill scratch scripts; Windows PowerShell environment and user's requirement to preserve existing scratch. No commits per explicit user instruction.
- Task 1 complete: new protocol assertion failed on unrecognized target/payment keys, then protocol suite passed 21/21. Strict unknown-field rejection retained.
- Task 2 complete: RED 8/34 new cases failed on unsupported action/Jim accepting Norman fields; GREEN 59/59 action+existing Norman tests, full engine 1247/1247. Atomic module and shared ledger implemented without new runtime dependencies.
- Task 3 complete: 3 real two-client room cases passed. Sandbox run failed before game commands (SDK fetch failed); identical elevated run passed, confirming loopback restriction rather than product failure.
- Task 4 in progress: RED browser failure confirmed absent target control. First UI run plus typecheck exposed incorrect assumption `baseGameMap.locations`; repository exports `baseGameLocations` separately. Corrected import/access, rerunning. An initial lobby test also needed to wait for Norman selection synchronization before guest selection, matching existing E2E pattern.
- Ruling: browser checks owner controls/reload/privacy; exact observer Monster synchronization is asserted in real SDK room tests, since current board does not render Monster-instance DOM elements. Removed a vacuous absent-element browser assertion.
- Dependencies restored with cached pnpm 10.28.0 then frozen online install for missing tarballs. Installed versions inspected: Colyseus 0.18.5, schema 5.0.32, Nuxt 4.5.2, Vue 3.5.42. Package manifests and lockfile unchanged. Nuxt prepare succeeded; existing esbuild/msgpackr build-script warnings retained.
- Task 4 complete: both dedicated browser cases passed (2/2); production starting-Spell journey passed (1/1). UI bug reproduced by browser stack trace and typecheck, fixed by using actual exported location catalog.
- Full-suite correction: first pnpm test run had 237 server cases passing and one new room fixture failing because a randomly drawn Monster's spawn movement left it away from its Gate. Bound the fixture target to an actual active Gate; no product rule changed. Next full pnpm test passed, including 238 server cases and 36 focused Norman action cases within the engine suite.
- Independent final review: clean-context reviewer read spec/plan/current changes, inspected authority, privacy, conservation, shared usage and snapshot conventions, and ran focused engine tests (36/36). No actionable findings; no reviewer fix pass needed.
- Final checks so far: pnpm lint PASS; pnpm typecheck PASS; pnpm test PASS; pnpm build PASS. Existing non-failing Nuxt/Vite devtools, NO_COLOR/FORCE_COLOR and Turbo missing-output warnings remain. Additional Spell browser regression and private-build boundary check are recorded below when complete.
- Final verification complete: engine 1249, content 104, protocol 21, server 238 tests passed (1612 total). Root lint/typecheck/test/build exited 0. Dedicated action Playwright 2/2, existing Spell casting Playwright 2/2, production starting-Spell Playwright 1/1 passed. Private Spell build boundary passed over 228 text artifacts, also excluding reverse image hashes. `git diff --check` clean; manifests/lockfile unchanged; HEAD remains `9c16ea6`. No commit/push/merge/deploy performed. Existing scratch contents preserved; new verification logs are local scratch only.
- Limitations: full investigator/Spell families and other Norman payment contexts remain unsupported. UI does not publish the private ledger to predict Sanity-substitution availability; server may reject a repeated use with an explicit error. Rulebook checked online; original Norman sheet was unavailable on this run, so printed action follows previously verified repository roster/source evidence. Observer synchronization is covered by real SDK multiplayer tests; browser tests cover controls, payments, privacy and reload.
