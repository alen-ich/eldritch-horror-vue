# Norman Acquire Assets Reroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Permit Norman's once-per-round Sanity-for-Clue reroll in Acquire Assets.
**Architecture:** Existing generic dice decision delegates eligibility/payment to the shared private ability module. Room restoration validates marked acquisition decisions; the browser uses existing owner choices.
**Tech Stack:** Pure TypeScript/Vitest, Colyseus 0.18.5/schema 5.0.32, Nuxt 4.5.2/Vue 3.5.42, Playwright 1.63.0; pnpm 10.28.0.
**Spec:** `docs/superpowers/specs/2026-10-21-norman-acquire-reroll-design.md`.

## Global constraints

Current directory/branch, preserve pre-existing edits; no new packages or protocol fields; hidden state server-private; no commits/push/merge/deploy. Only Acquire Assets is added to existing Spell/action contexts. Self-approval authorized by user.

## Review focus

1. Restore a snapshot missing the ability ledger: reject before synchronized mutation.
2. Deterministic reroll input exhaustion: reject without payment, state or RNG consumption.
3. Trish at the same space with zero physical Clues: reject applicable unsupported two-die interaction.
4. Action or Spell already used the substitution: acquisition must not replenish it.
5. Wrong actor, stale/replayed decision, final Sanity: no mutation or second payment.

### Task 1: Engine eligibility and atomic payment

**Files:** modify `packages/engine/src/norman-clue-substitution.ts`, `packages/engine/src/index.ts`; create `packages/engine/test/norman-acquire-reroll.test.ts`.
**Interfaces:** `canUseNormanTestReroll(state: GameState, playerId: string): boolean`, `spendNormanTestReroll(state: GameState, playerId: string): boolean`; retain existing Spell helpers. `validateNormanAcquireRerollState(state: GameState, content: GameContent): string | undefined` validates marked acquisition test decisions and Trish applicability; reuse `testRerollDecisionIsValid`.

- [x] RED: tests start ACQUIRE_ASSETS with zero Clues, dice [1,2], reserve of value-one Assets; expect `norman-sanity:0` owner option. Select it with die 6: Sanity 7→6, die [6,2], purchase strength 1, physical supply unchanged, one version per command. Cover decline, Sanity 2/1, already-used ledger, wrong actor/phase/continuation, shared Spell/action usage, legacy initialization, malformed restoration, initial/resumed Trish, RNG exhaustion/rollback.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/norman-acquire-reroll.test.ts`; expect absent option failures.
- [x] GREEN: dispatch new helper only for acquisition or existing supported Spell; initialize marker/ledger in accepted acquisition. Transactionally execute Norman initial/resumed acquisition via context checkpoint, return explicit errors on invalid RNG. Validate marked decisions before execute; allow genuine unmarked legacy decisions.
- [x] Run focused tests plus existing Norman/spell suites, then engine suite. Expected exit 0.

### Task 2: Room restoration and real multiplayer

**Files:** modify `apps/server/src/rooms/GameRoom.ts`, `apps/server/test/GameRoom.test.ts`; create `apps/server/test/NormanAcquireReroll.test.ts`.
**Interfaces:** call Task 1 validator before `applyEngineState` mutates private/public fields. Register `registerNormanAcquireRerollRoomTests(getServer)` alongside existing room suites.

- [x] RED: real two-client production start, normalize host to clear City/zero Clues; force initial dice deterministically through existing test input hook if available or assert invariant independent of dice. Test Sanity option ownership, guest rejection, stale version, one payment, observer state, missing ledger/fabricated options restoration rejection and snapshot round trip.
- [x] Run `pnpm --filter server exec mocha -r tsx test/GameRoom.test.ts --grep "Norman acquisition" --exit --timeout 15000`; expect restore validation failure before implementation.
- [x] GREEN: wire validator into restoration; reuse room commands/private delivery. Run focused room suite. Expected exit 0.

### Task 3: Browser, documentation and final verification

**Files:** create `tests/e2e/norman-acquire-reroll.spec.ts`; update `docs/rules/base-game-investigators.md`, `docs/project-owner-guide.md`, `docs/exec-plans/base-game-rules-implementation.md`, this journal.
**Interfaces:** production lobby, existing `Acquire Assets` action and generic owner dice options; no fixture production changes.

- [x] Browser uses two contexts, Norman/Mark/Azathoth, waits for synchronized selections. Move Norman only if needed to a Monster-free City; ordinary initial Arkham normally clear but random setup must be handled deterministically from UI or fixture if necessary. Acquire, reload during decision, keyboard choose `Spend 1 Sanity (Norman): reroll die 1`, assert public Sanity decreases once and option disappears after reload; observer never receives option. Complete existing purchase/decline decision if needed.
- [x] Run `pnpm exec playwright test tests/e2e/norman-acquire-reroll.spec.ts`; expected exit 0. Existing action fixture and Spell regressions also run.
- [x] Update implementation scope, preserving historical sections and readiness exclusions.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, multiplayer focus, relevant Playwright, `git diff --check`. Expected exit 0; log actual evidence and restrictions.
- [x] Read requesting-code-review and dispatch one clean-context independent reviewer with spec, plan and current changes. Reproduce material findings RED→GREEN and rerun checks as warranted. Inspect final diff and report without committing.

## Self-review and approval

All spec requirements mapped to tasks; no new network types; private validator covers restoration in addition to command execution. Existing round reset/Spell tests retained. Self-approved per user; execute inline.

### Verification-discovered task: preserve private messages across older patches

**Files:** create `apps/web/app/game/private-decision-inbox.ts`, `apps/server/test/PrivateDecisionInbox.test.ts`; modify `apps/web/app/composables/useGameRoom.ts`.
**Interfaces:** `createPrivateDecisionInbox()` returns `receive(decision: PendingDecision)`, `sync(summary?: PendingDecisionSummary)`, `clear()`. Keep at most eight messages, keyed by decision ID; never return another ID's options.

- [x] RED: final unchanged Spell browser suite 0/2; inspect trace and client sync: pending private choice is lost when older absent/different summary overwrites it. Retain browser reproduction, add deterministic pure tests for private-first/older patches, public-first and clear.
- [x] GREEN: route private message receive and schema summary reconciliation through bounded inbox; clear on room attachment. Run `pnpm --filter server exec mocha -r tsx test/PrivateDecisionInbox.test.ts --exit`, full root checks, default and Spell Playwright. Expected exit 0.

Self-review: this is a necessary prerequisite of reliable owner choices used by acquisition as well as Spell casting, not a gameplay expansion. Scope amendment self-approved per user authorization.

## Execution journal

- Pre-flight: current branch `master`; existing Norman action edits/untracked files and `.superpowers/` preserved. No worktree/commit. Use this journal instead of skill Bash scratch scripts: PowerShell host, uncommitted user work, persistent record required.
- Environment: pnpm launcher attempts unavailable registry resolution; cached pnpm 10.28.0 executable verified. Use it via PATH for checks without modifying repository manifests/lockfile.
- Pre-flight interfaces: Task 1 exports validator consumed by Task 2 before room mutation; existing owner decision UI consumed by Task 3. No interface conflicts. TDD/systematic-debugging/verification skills read.
- Task 1 RED: 10/11 acquisition tests failed, including absent payment, missing legacy initialization, unsupported Trish and exhausted input throwing. Corrected test-only `maxTotalValue` assumption to actual `selectionBudget`. GREEN 11/11; complete engine 1260/1260. Shared Spell-only API retained; added allowlisted dispatcher and acquisition transaction/validation.
- Task 2 RED: sandbox blocked SDK loopback before commands (`fetch failed`); same run outside sandbox reproduced missing restore exception, 1/2 failing. GREEN after restoration wiring: real multiplayer 2/2, including reconnect, stale/replayed and foreign actor, observer privacy and room isolation. No network/protocol changes.
- Task 3 browser first run: source selection alone does not submit existing dialog; inspected app.vue and existing Spell test, added `Use selected reroll` confirmation. No product fix required. Root typecheck passed.
- Ruling: preserve user's current uncommitted work and record journal here rather than Bash scratch/commit helpers; no cleanup of pre-existing scratch. Cost: review must distinguish this slice from the earlier Norman action diff.
- Task 3 initial verification: production browser 1/1; full default Playwright 6/6 (including existing acquisition, starting Spell and Spell inventory journeys); Norman action browser regression 2/2. Root lint/typecheck/test/build exited 0; engine 1261, content 104, protocol 21, server 240 passed before review fixes. Existing Nuxt/Vite, color, npm config and Turbo output warnings remain non-failing.
- Browser stabilization: initial post-start command sometimes observes a stale schema version, matching the existing multiplayer journey. Retry only that unaccepted initial acquisition until its dialog appears; never retry accepted payment. Payment dialog itself required explicit source selection plus confirmation. No product changes for these test assumptions.
- Independent final review (clean context, gpt-6-astra): two Important findings, no Critical/minor findings. Reviewer independently reproduced legacy continuation and forged-success bugs; unrelated previous action changes and unsupported test contexts excluded from correctness claims.
- Final: fixed legacy resumed acquisition missing capability initialization — new legacy physical-Clue-reroll regression RED (marker undefined) → GREEN. Accepted cloned continuation initializes marker/ledger before rebuilding choices and rechecks Trish; rejected input remains transactional.
- Final: fixed corrupted acquisition derived values — new regression RED (successes=99 accepted) → GREEN; validate successes with the same production recount (including double sixes), threshold, modifier, dice/pool length and decision kind. Added room corruption coverage plus legitimate double-six budget case. Focused engine 15/15 passed; repeating all root checks and relevant browser tests.
- Ruling: reviewer excluded pre-existing Norman action/UI changes and unsupported test contexts; retain their existing regressions and scope exclusions rather than expanding this slice. Cost: this work does not certify full investigator/Spell support.
- Final verification after fixes: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0. Engine 1264, server 240, content 104, protocol 21: 1629 passed. Default Playwright 6/6 passed again. Dedicated Norman action 2/2 and Spell casting 2/2 passed before review fixes; final Spell rerun tracked below. `git diff --check` clean; manifests/lockfile unchanged; HEAD remains `9c16ea6`, branch `master`.
- Finishing: follow verification-before-completion and finishing-a-development-branch; user's explicit no-commit/push/merge/deploy instruction selects keeping all work in place, so no integration menu or Git mutation is needed. No scratch cleanup because evidence and pre-existing work must remain available.
- Limitations: only Acquire Assets is added to Norman's two prior substitution contexts; applicable Trish interaction and other test continuations remain unsupported. No new package or full-family readiness claim. Public observer synchronization is asserted at the real SDK boundary; production browser covers owner interaction, reload, completion and DOM privacy. Official Reference Guide fetched; Norman sheet URL unavailable, using prior verified repository evidence.
- Ruling: final Spell browser regressions exposed a prerequisite in existing choice delivery, so scope adds a bounded client inbox and pure tests, rather than hiding the failure by reloading the recipient in tests. Cost: a small shared client transport change requires broader browser verification. Same independent reviewer inspected this new scope without re-reviewing engine fixes: no findings; pure tests 2/2.
- Inbox diagnosis: preserving choices fixed loss, but still showing an ahead-of-schema message allows a fast recipient click with the previous state version. Trace reached Lily improvement then waited for Decline; options must render only alongside their matching public snapshot/version. Handler now caches and reconciles through `syncState(nextRoom.state)`, rather than exposing ahead-of-schema choices immediately.
- Verification correction: running full server tests concurrently with isolated Spell Playwright caused `EADDRINUSE :::2568` (shared existing test port), not a product failure. Subsequent root/server and browser runs are sequential. Inbox typecheck first found a test fixture missing required `optionCount`; corrected the fixture, no protocol changes.
- Inbox fix verification: unchanged Spell browser reproduction GREEN 2/2 after matching public snapshot/version gating; pure inbox tests 2/2. On final tree, sequential lint/typecheck/test/build all exit 0: engine 1264, server 242, content 104, protocol 21 = 1631 passed. Existing output/config/color/devtools warnings are non-failing. Remaining browser runs recorded below.
- Final browser verification on final tree: default 6/6, Norman action 2/2, Spell casting 2/2, all exit 0. No failed required checks remain. One independent reviewer, with a narrow follow-up for the verification-discovered client prerequisite; both material engine findings fixed by failing regressions, client follow-up has no findings. `git diff --check` clean. Existing files/scratch preserved; no manifest/lockfile or Git history changes. Chat renamed to identify Norman's acquisition reroll work.
