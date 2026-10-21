# Feed the Mind Casting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, natively in the current session. Steps use checkbox (`- [ ]`) syntax for tracking. The user selected native execution; do not delegate implementation.

**Goal:** Make both physical copies of Feed the Mind executable through a private, deterministic, reconnectable casting lifecycle.

**Architecture:** Add a focused engine casting module with engine-owned private rule types and narrow adapters to existing test/action helpers. The server injects handwritten private handlers; protocol/UI expose front identity and owner choices only. Reuse existing tests, rerolls, improvements, damage, and physical Spell conservation.

**Tech Stack:** TypeScript; pnpm 10.28.0; Vitest 3.2.7; Zod 4.6.5; Colyseus 0.18.5/schema 5.0.32/SDK 0.18.2; Nuxt 4.5.2/Vue 3.5.42; existing Mocha and Playwright. No added or upgraded dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-feed-the-mind-casting-design.md` (approved; this plan awaits approval).

## Global constraints

- Work in the current checkout on `master`. Preserve all pre-existing tracked/untracked changes. Do not commit, push, merge, deploy, or create a worktree.
- Server owns outcomes and identity. Runtime-validate commands and restored private state. Engine stays pure TypeScript with no server/framework/filesystem imports.
- Execute Feed the Mind only; other Spells, starting grants, trading, reward encounters, Norman's substitution ability, and Other World 1/6/20 remain unsupported.
- Keep physical IDs, reverse tables, and usage by physical component in `privateState`. Family readiness remains `needs_review`.
- Lore modifier is -1; improvement cap is +2; Lily may double each applicable improvement; supported auras and free/Clue rerolls retain existing semantics.
- Charge one component action per cast, even on failure/discard. Keep the action reserved while resolving; do not advance the turn before completion or interrupt defeat handling.
- One canonical version increment per successful external command; failed commands publish no state/events and do not consume injected deterministic inputs.
- Maintain the execution ledger below, record RED/GREEN evidence and justified deviations, continue through approved tasks without intermediate approvals, and use one fresh reviewer only at the end.

## Review focus

1. A caster uses their last action and a colleague owns the next choice: the caster's turn must not advance prematurely (Task 3).
2. A die is changed to/from four by a reroll or Cigarette Case: the reverse must inspect final dice, not original faces or successes alone (Task 4).
3. A restored snapshot changes a recipient, physical source, stage, or current round: reject before touching the valid room state (Tasks 3 and 5).
4. A Spell is discarded/reacquired in the same round, or a future owner changes: physical component use persists until the actual round reset (Task 3).
5. Browser tests accidentally reach an old development server or fixture endpoints reach production: use dedicated ports, no server reuse, and production-import boundary assertions (Task 6).

## Files and interfaces

Paths below are repository-relative. Unlisted unrelated files are out of scope. Existing files already contain user changes; edit only relevant sections.

| Files | Responsibility |
| --- | --- |
| `packages/protocol/src/index.ts`, `packages/protocol/test/protocol.test.ts` | Strict cast command, decision kinds, test continuation; no physical IDs |
| New `packages/engine/src/spell-casting.ts` | Private types, state validation, Feed the Mind continuation and component accounting |
| New `packages/engine/src/spell-test-assets.ts` | Spell-specific Asset applicability and bonus collection |
| `packages/engine/src/index.ts` | Private-state/content interfaces, dispatch and existing test/action adapters, round resets, deterministic context checkpoints |
| `packages/engine/src/spells.ts` | Existing inventory validation/discard and front capability integration only |
| `packages/content/src/spells.ts`, `packages/content/src/assets.ts` | Per-kind support metadata, typed Spell Lore bonus |
| New `packages/engine/test/spell-casting-fixtures.ts`, `spell-casting.test.ts`, `spell-test-assets.test.ts`, `spell-casting-reverses.test.ts`, `spell-casting-privacy.test.ts`, `spell-random-transaction.test.ts` | Synthetic private rules, deterministic engine regressions |
| `packages/engine/test/skill-tests.test.ts`, `packages/content/test/spells.test.ts`, `packages/content/test/assets.test.ts` | Existing generic tests and content regressions |
| New `apps/server/src/private-feed-the-mind.ts`, `apps/server/test/FeedTheMindRules.test.ts` | Handwritten private executable rules verified against catalog/crops |
| `apps/server/src/rooms/GameRoom.ts` | Rules injection, context factory, private restoration, owner decisions |
| New `apps/server/test/SpellCasting.test.ts`; `apps/server/test/GameRoom.test.ts`, `SpellBackPrivacy.test.ts` | Registered real-room tests and privacy regressions |
| `apps/server/src/spell-back-privacy.ts`, `apps/server/scripts/verify-spell-back-privacy.ts` | Explicit private-handler import/build exclusion |
| `apps/web/app/components/SpellInventory.vue`, `EncounterChoicePanel.vue`, `apps/web/app/app.vue`, `apps/web/app/composables/useGameRoom.ts` | Front-only cast controls, decision rendering and availability |
| New `apps/server/test/fixtures/spell-casting-server.ts`, `tests/e2e/spell-casting.spec.ts`, `playwright.spell-casting.config.ts` | Isolated seeded browser fixture and focused two-browser journey |
| `docs/rules/base-game-spells.md`, `docs/exec-plans/base-game-rules-implementation.md`, `docs/project-owner-guide.md`, this plan | Accurate status, execution evidence and limitations |

### Engine contracts to introduce

Define these in `spell-casting.ts` and export needed types/functions through engine `index.ts`. No reverse prose belongs in these types.

```ts
type FeedTheMindBackRule =
  | { type: "optional_sanity_loss_or_discard_then_optional_improve" }
  | { type: "discard_unless_final_four_else_sanity_loss" };
interface PrivateSpellCastingRules {
  feedTheMindByPhysicalId: Readonly<Record<string, FeedTheMindBackRule>>;
}
type SpellCastStage = "test" | "target" | "front_improve"
  | "reverse_loss_choice" | "reverse_improve";
interface PendingSpellCast {
  casterPlayerId: string;
  sourcePhysicalId: string;
  startedTurnNumber: number;
  stage: SpellCastStage;
  actionReserved: true;
  recipientPlayerId?: string;
  finalDice?: number[];
  finalSuccesses?: number;
}
interface PrivateSpellCastingState {
  usedPhysicalIds: string[];
  pending?: PendingSpellCast;
}
```

`PrivateGameState.spellCasting?: PrivateSpellCastingState` and `GameContent.privateSpellCastingRules?: PrivateSpellCastingRules` are optional for backward compatibility. Initialize casting state with Spell inventory at new setup; legacy valid snapshots without it normalize to `{ usedPhysicalIds: [] }` only when no Spell cast/test/decision is pending. Never regenerate inventory or silently repair an inconsistent pending cast.

Use existing `RuleErrorCode` values where suitable; add `SPELL_CAST_INVALID` and `SPELL_RANDOM_INPUT_INVALID` for coherent-source/continuation and transactional input failures. Continue using `SPELL_EFFECT_UNSUPPORTED`, `SPELL_INVENTORY_INVALID`, `RANDOM_INPUT_REQUIRED`, phase/owner/selection errors.

Exact transition exports:

```ts
validateSpellCastingState(state: GameState, content: GameContent): string | undefined;
beginSpellCast(state: GameState, casterId: string, content: GameContent,
  context: EngineContext, adapters: SpellCastingAdapters): CommandResult;
finishSpellCastTest(state: GameState, test: ActiveTest, content: GameContent,
  context: EngineContext, adapters: SpellCastingAdapters): CommandResult;
resolveSpellCastDecision(state: GameState, actorId: string, command:
  Extract<GameCommand, { type: "RESOLVE_DECISION" }>, content: GameContent,
  context: EngineContext, adapters: SpellCastingAdapters): CommandResult;
```

All three transitions clone input, preserve its version, and return public-safe events. `executeCommand` alone increments once for the external operation. `finishSkillTest` must propagate a rejected Spell continuation as a `CommandResult`, rather than flattening errors into an empty event array: introduce a Spell-specific dispatch before its existing event-only branches and cover both immediate and reroll completion. Keep unrelated continuations unchanged.

`SpellCastingAdapters` supplies `beginTest(state, player, request, content, context): GameEvent[]` with the existing `beginSkillTest` request shape, `damage(state, playerId, health, sanity, content): CommandResult`, and `completeAction(state, actorIndex, action, events): void` using existing functions. Use type-only imports in the focused module. The generic test's completion callback returns to the Spell dispatcher; do not call engine `executeCommand` recursively.

Add `checkpoint?(): { commit(): void; rollback(): void }` to `EngineContext`; implement it in `createDeterministicEngineContext` by snapshotting its four queues. New Spell command paths require a checkpoint-capable context; old callers are unaffected. A local `withSpellRandomTransaction(context, run: () => CommandResult): CommandResult` commits on success, restores on rejection/throw, and converts malformed/exhausted inputs to `SPELL_RANDOM_INPUT_INVALID`. Wrap start and every Spell-owned continuation, including the existing reroll route. This is needed because the current context consumes queues destructively and cannot otherwise meet the spec's rejection guarantee. Server Spell commands use a deterministic context, not the uncheckpointed live random context.

### Protocol and UI contracts

- Command: `{ type: "CAST_SPELL", spellId: "spell_feed_the_mind" }`, strict Zod literal fields, existing versioned envelope. Reject extra actor/target/dice/source fields and other Spell IDs.
- Add decision kinds `spell_target`, `spell_improvement`, `spell_reverse_choice`; continuation `spell_cast_choice`; `ActiveTest.continuation` adds `spell_cast`. No `sourcePhysicalId` field in `ActiveTest` or public schema.
- Options: target uses existing public player ID; improvement uses `improve:<skill>:1` and, for Lily, `improve:<skill>:2`; optional additional improvement also has `decline`; reverse choice uses `lose_sanity` / `discard_spell`. These reveal only the owner's current choices, not a private copy ID/table. Validate against the actual stage and owner, not just membership in a generic option list.
- No new private reverse message is needed. Existing targeted owner decisions carry concise action labels and generic prompts; final resource/improvement events describe consequences. Do not send catalog prose or implement the spec's optional selected-resolution message without demonstrated UI need.
- `SpellInventory` adds `canCastFeedTheMind?: boolean` and emits `cast` with `"spell_feed_the_mind"`. The room exposes `castableSpellIds` as a front-only comma-separated per-player schema string, computed from the same side-effect-free eligibility check used by engine dispatch. It must not expose the private reason, physical use list, or branch. Wire through `PlayerState` in `apps/server/src/rooms/schema/GameRoomState.ts` and `ClientPlayerState`/sync in `useGameRoom.ts` (these two existing files are additional listed adapter edits).

## Task 1: Public cast contract and private continuation validation

**Files:** protocol source/tests; new `spell-casting.ts`, `spell-casting-privacy.test.ts`; engine `index.ts`; `spell-casting-fixtures.ts`; content Spell source/test.

**Consumes:** existing `GameCommand`, `GameState`, `PendingDecision`, `ActiveTest`, inventory validation and front projection.
**Produces:** contracts above; `validateSpellCastingState`; `spellExecutionSupport(frontId: SpellFrontId): "feed_the_mind" | "unsupported"` exported by content, used only as capability metadata. Descriptive `effectStatus` gains a narrowly named `scoped_executable` value for Feed the Mind only, with other kinds `not_executable`; readiness unchanged.

- [ ] **RED:** Add protocol cases asserting valid literal cast is accepted and physical IDs, other fronts, forged fields and invalid decision continuations are rejected. Add engine tests for missing/duplicate/wrong-owner sources, illegal stages, inconsistent final-dice/result fields, wrong pending owner, and mixed unrelated pending continuations. Assert `projectPublicState` omits all casting internals.
- [ ] **Observe RED:** `pnpm --filter @eldritch/protocol test`; `pnpm --filter @eldritch/engine exec vitest run test/spell-casting-privacy.test.ts`. Expected failures identify absent contract/validation, not unrelated fixture errors.
- [ ] **GREEN:** Implement the contracts, strict stage validation, setup/legacy initialization and content capability. Keep pending data exclusively inside `privateState`; projection's existing object spread must not gain a top-level private field. Add `projectPublicState` assertions for every stage.
- [ ] **Verify:** rerun both commands and `pnpm --filter @eldritch/content exec vitest run test/spells.test.ts test/readiness.test.ts`. Expect zero failures and only Feed the Mind marked scoped.

## Task 2: Transactional random input and Spell test applicability

**Files:** engine `index.ts`, new `spell-test-assets.ts`, `spell-test-assets.test.ts`, `spell-random-transaction.test.ts`; content Asset source/test; existing engine skill tests.

**Consumes:** Task 1 private state/types; `calculateDicePool`, existing aura, physical uniqueness and reroll helpers.
**Produces:** context checkpoints and `withSpellRandomTransaction`; `spellTestItemBonuses(state, playerId, content): number[]`; `validateSpellTestApplicability(state, playerId, content): CommandResult | undefined`. Add `{ type: "spell_lore_bonus"; amount: 1 }` to both structural Asset effect unions and Arcane Manuscripts' typed effects.

- [ ] **RED:** Assert a rejected/throwing transaction restores subsequent die, shuffle, token and ID results, while accepted input advances once. Test exhausted/invalid dice and shuffle queues and missing checkpoint support. Pin Lore 3, modifier -1, improvement +1, Manuscripts +1 => four dice; two bonuses use the highest, not their sum; minimum one die; Manuscripts adds nothing to ordinary Lore/Acquire/Artifact tests. Pin Urban Guide City aura and no remote/dead aura.
- [ ] **Observe RED:** `pnpm --filter @eldritch/engine exec vitest run test/spell-random-transaction.test.ts test/spell-test-assets.test.ts test/skill-tests.test.ts`.
- [ ] **GREEN:** Implement queue snapshots without global state. Define explicit Spell-scope applicability: supported existing typed test effects apply; verified combat/Acquire/Rest-only effects are irrelevant. Unknown relevant effects and Norman's unimplemented Clue-substitution applicability reject before rolling. Do not use an empty effects list as evidence of irrelevance. Validate physical uniqueness for relevant held/aura cards and Clue holdings before spending/rerolling.
- [ ] **Verify:** rerun the focused command and `pnpm --filter @eldritch/content exec vitest run test/assets.test.ts`; keep ordinary encounter/Artifact bonus regressions green.

## Task 3: Cast start, front choices and action accounting

**Files:** `spell-casting.ts`, engine `index.ts`, new `spell-casting.test.ts`, fixtures; `spells.ts` only if shared source checks are needed.

**Consumes:** Tasks 1–2; existing generic test/reroll and action completion helpers via `SpellCastingAdapters`.
**Produces:** `beginSpellCast`, Spell test dispatch and `resolveSpellCastDecision` through the front improvement; side-effect-free `canCastFeedTheMind(state, playerId, content): boolean` for the server projection.

- [ ] **RED:** Start with a conserved held copy and assert Lore -1, input unchanged, exactly one version increment, no branch identity in test/projection. With fixed passing dice, caster selects self/colleague and only that recipient selects a skill; +2 cap and Lily once/twice choices work. Assert wrong actor/space/phase, no actions/card, delayed/detained, terminal/pending state and a used copy reject before calling `rollDie`. With one action remaining, a colleague-owned choice does not advance the caster's turn.
- [ ] **Observe RED:** `pnpm --filter @eldritch/engine exec vitest run test/spell-casting.test.ts`.
- [ ] **GREEN:** Dispatch cast before generic turn restrictions only after validating actor; dispatch Spell recipient decisions through owner validation without requiring recipient to be the active investigator. Reserve the current action by a pending cast lock, mark physical use at successful start, but defer the existing `completeAction` decrement/advance until normal completion. Do not prohibit another component solely because `performedActions` contains `component`. Persist final test faces/result, then target, then recipient improvement, then reverse stage.
- [ ] **GREEN:** Block unrelated commands for any pending cast even when `pendingDecision` is temporarily absent. Permit its exact decision and existing defeat resolution only. Reject changed source/recipient/turn on resume. Clear used physical IDs at both existing new-round/setup reset paths, never on turn handoff, discard, gain or ownership change.
- [ ] **Verify:** rerun focused tests plus existing `test/artifact-action.test.ts`, `test/de-vermis-mysteriis.test.ts`, `test/spell-lifecycle.test.ts`. Test same-round discard/reacquisition remains used and a legal new round allows reuse. Until Task 4 is integrated, incomplete reverse stages must reject safely, never report a completed cast.

## Task 4: Both private reverse handlers and safe interruption

**Files:** `spell-casting.ts`, engine `index.ts`, `spell-casting-reverses.test.ts`; new `private-feed-the-mind.ts`, `FeedTheMindRules.test.ts`; fixtures; privacy tests.

**Consumes:** Task 3 final dice/recipient and existing discard/damage helpers. Private rule tags are defined in Task 1.
**Produces:** `privateFeedTheMindRules: PrivateSpellCastingRules` in the server module; complete reverse and completion paths in `resolveSpellCastDecision` / `finishSpellCastTest`.

- [ ] **RED:** In server-only tests, verify each executable handler maps to the correct catalog physical record and visually recheck its existing front/back crop. Keep actual copy-to-rule assertions in server tests, not shared content or docs. Engine fixtures use synthetic rules under private engine inputs and never import server modules.
- [ ] **RED:** Test the optional-loss handler at final successes 0, 1, 2, 3 and above: low-result discard/loss alternatives; high-result optional recipient improvement/decline. Test the final-four handler with zero successes and final four present/absent, then one-plus successes and mandatory loss. Use private records as authority for exact amounts/thresholds. Test a reroll removing/adding four, Case changing 3→4 or 4→5, Blessed four counting as a success, and a retained card returning to its front without changing copy.
- [ ] **Observe RED:** `pnpm --filter @eldritch/engine exec vitest run test/spell-casting-reverses.test.ts`; `pnpm --filter server exec mocha -r tsx test/FeedTheMindRules.test.ts --exit --timeout 15000`.
- [ ] **GREEN:** Implement only those two handwritten rules, with ordered front-before-reverse behavior. Reuse physical discard/shuffle. Optional second improvement uses the previously selected recipient; loss-versus-discard belongs to caster. Apply ordinary loss, not spend. Reserve cost is finalized once even if caster is defeated: decrement and record `component` but defer active-player advancement while `pendingDefeat` exists; let existing defeat resolution select the next legal investigator. Clear Spell pending/test/decision before returning defeat or terminal state, and never restore a discarded card.
- [ ] **GREEN:** Preflight loss branches before starting. Since general reaction integration is excluded, conservatively reject casts with applicable unsupported Spell protection or same-space optional Asset prevention rather than skipping it; keep the discard alternative from acting as a hidden reaction bypass. Recheck on resume. Unsupported non-Azathoth awakening resulting from loss rejects before the cast begins at that Doom/resource boundary. Use existing unsupported error paths.
- [ ] **Verify:** rerun engine/server commands, existing `test/spell-guards.test.ts` and `test/encounter-prevention.test.ts`. Cover JSON round-trip at every stage, exhausted discard shuffle rollback, Sanity defeat, Azathoth terminal loss, no double action charge, and one-version success per command. Keep existing Health-defeat regressions green; this card does not itself cause Health loss. Reject invalid source/deck restoration without mutating the input.

## Task 5: Real-room integration, restoration and privacy

**Files:** `GameRoom.ts`, schema `GameRoomState.ts`, new `SpellCasting.test.ts`, existing `GameRoom.test.ts`, `SpellBackPrivacy.test.ts`, privacy scanner/build script.

**Consumes:** Tasks 1–4 exports and private rules; existing Colyseus APIs and room test harness.
**Produces:** private-rule injection into `baseGameContent`, validated private round trips, front-only `PlayerState.castableSpellIds`; `registerSpellCastingRoomTests(getServer: () => ColyseusTestServer<typeof appConfig>): void` registered inside the existing booted suite.

- [ ] **RED:** Two real clients receive a held front and cast availability, never the physical source or handler. Owner-only recipient decision goes to recipient; caster/other room cannot answer it. Save/restore each stage, disconnect/reconnect recipient and caster, reject stale/duplicate/malformed commands, and leave the last valid room state unchanged for corrupt source/turn/stage/owner snapshots. Change a returned snapshot and prove it is detached.
- [ ] **Observe RED:** `pnpm --filter server exec mocha -r tsx test/GameRoom.test.ts --grep "Spell casting" --exit --timeout 15000` (registered suite title exactly `Spell casting`).
- [ ] **GREEN:** Clone private casting state with existing private snapshot. Validate casting before any public/private room mutation. Extract existing context selection unchanged into `protected createEngineContext(command: GameCommand): EngineContext | undefined`; Spell start/resumes use `createDeterministicEngineContext` with server-generated queues sized for the current test/shuffle. Existing commands retain their current context behavior. Provide enough shuffle indexes for a 20-card deck and enough IDs for the full current transition; errors reject without publishing partial state.
- [ ] **GREEN:** Compute public cast availability through `canCastFeedTheMind`; add no private source field to schema. Send only existing authorized pending decisions on apply/reconnect/seat recovery; clear stale owner options in client state when summary ID disappears/changes. No reverse text message is introduced.
- [ ] **GREEN:** Extend private import scanning to forbid `private-feed-the-mind` from public entry graphs, and build scanning to detect its handler table without flagging generic engine rule type names. Keep all existing reverse-byte/text checks. Inspect public schema, projected events, owner and non-owner payloads at each stage. No blanket whitelist for owner traffic.
- [ ] **Verify:** rerun registered suite and `pnpm --filter server test`; run the built-artifact scanner after the final build in Task 8. Existing inventory, privacy and encounter suites must remain green.

## Task 6: Isolated deterministic browser fixture

**Files:** new `apps/server/test/fixtures/spell-casting-server.ts`, `playwright.spell-casting.config.ts`, `tests/e2e/spell-casting.spec.ts`; extend privacy boundary tests to check fixture exclusion. No production config/entry edits.

**Consumes:** protected room context factory from Task 5, internal conserved gain helper, existing Nuxt runtime `NUXT_PUBLIC_COLYSEUS_URL`.
**Produces:** a standalone test entry on port 2568 and browser config on port 3001. The production entry remains `src/index.ts` and build includes only `src`.

- [ ] **RED:** Browser fixture creates two seats with Trish and Lily, starts Azathoth, grants only Feed the Mind through the conserved internal helper, co-locates recipients, and pins passing dice. First assert the held Feed the Mind front appears in the existing read-only tray and survives reload; this fails without fixture seeding and does not depend on Task 7 controls. Add boundary tests that production server config/index import no fixture and built server contains no fixture grant handler.
- [ ] **Observe RED:** `pnpm exec playwright test --config playwright.spell-casting.config.ts tests/e2e/spell-casting.spec.ts`.
- [ ] **GREEN:** Test-only subclass wraps the inherited command message handler: after successful START_GAME and only once, seed canonical holdings/co-location using the same internal snapshot access pattern as existing room tests. Override `createEngineContext` only for Spell fixture commands. Do not register a grant endpoint or alter production `GameRoom` outcomes. Use existing installed `defineServer`/`defineRoom`/`listen` APIs as in server config; verify signatures locally before use.
- [ ] **GREEN:** Dedicated Playwright config sets both `reuseExistingServer: false`, local URLs/ports, Nuxt `NUXT_PUBLIC_COLYSEUS_URL=http://127.0.0.1:2568`, and the fixture server's `PORT=2568` through `webServer.env`; commands contain no shell-specific environment assignment. Exclude the focused spec from the ordinary config via a filename-specific `testIgnore` (the only change to existing `playwright.config.ts`).
- [ ] **Verify:** run fixture isolation/server boundary tests and the focused held-front/reload browser case; both pass before Task 7 adds cast-control expectations. No test data or private rules may enter the web bundle.

## Task 7: Cast controls and cross-player decision UX

**Files:** Spell inventory/choice components, `app.vue`, `useGameRoom.ts`; browser spec/config from Task 6; existing `tests/e2e/spell-inventory.spec.ts`.

**Consumes:** front capability, `castableSpellIds`, existing `game.send` and pending decision delivery. Emits the exact Task 1 cast command.
**Produces:** held Feed the Mind cast button, generic Spell choice rendering, restored focus and cleared stale choices. Unsupported/unheld supply remains read-only.

- [ ] **RED:** Extend focused browser assertions: caster selects colleague; only colleague sees skill options; caster sees waiting state; colleague reloads before choosing and resumes the same seat/decision; keyboard selects an improvement; both clients observe it and casting completes with one action charged. Verify no cast button for unheld/supply-only or unsupported cards, no physical IDs/private reverse URL in DOM or captured public messages.
- [ ] **Observe RED:** rerun focused browser command from Task 6 and capture the missing-control/decision failure.
- [ ] **GREEN:** Wire public availability to `SpellInventory` prop/event and `CAST_SPELL`. Extend existing `EncounterChoicePanel` to recognize all three Spell decision kinds with `Spell action` heading; reuse existing reroll UI. Focus first decision button on new decision, trap Tab inside the modal, and return focus to the cast button if present at completion. Update status copy to describe scoped support without saying all Spells execute. Clear old owner decisions on summary changes; do not optimistically update resources or duplicate sends on reconnect.
- [ ] **Verify:** focused browser case passes, existing supply test passes under the ordinary config, and web lint/typecheck pass. Record actual browser coverage, including whether retained/discarded reverse outcomes are browser-tested or engine/room-only.

## Task 8: Final regression, one fresh review and status update

**Files:** tests added above, status docs listed in file map, this plan's ledger.

**Consumes:** all completed tasks. **Produces:** reviewed implementation with actual verification evidence; no Git integration actions.

- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` sequentially. The root tests include server multiplayer; also record explicit `pnpm --filter server test`. Record counts/exit codes rather than treating historical results as current.
- [ ] Run `pnpm --filter server exec tsx scripts/verify-spell-back-privacy.ts` against the fresh web build. Expect success with no private handler table, reverse text/bytes or fixture code in public artifacts.
- [ ] After build/typecheck finish, run the focused browser command, then `pnpm test:e2e` sequentially. Never overlap browser runs with Nuxt generation. Check only processes started for this task if cleanup is needed; do not stop unrelated servers.
- [ ] Update Spell rules, roadmap and owner guide with one executable kind, scoped modifiers, conservation/visibility behavior, remaining unsupported reactions/acquisition and actual test coverage. Correct only directly superseded Spell status; preserve unrelated historical entries.
- [ ] Use `superpowers:requesting-code-review` and one fresh reviewer at the end, with the approved spec/plan, task-specific diff and pre-existing-change boundary. Reviewer checks spec adherence, test gaps, private projections, last-action/defeat behavior and fixture isolation. Do not dispatch implementation subagents or per-task reviewers.
- [ ] For each important actionable finding: write a reproducing test, observe RED, fix minimally, observe GREEN, and rerun affected checks plus final required verification. Use systematic debugging on any unexpected failure. Record findings and fixes, including those deferred with reasons. Do not claim a second review if only tests were rerun.
- [ ] Review `git diff` and all new files; verify no unrelated changes were overwritten, no secrets added and no commit/push/deploy occurred. Report actual passing/blocked checks and deviations to the user.

## Verification environment

The previous specification session's `pnpm lint` and package listing failed before tasks ran because the launcher could not resolve pinned pnpm 10.28.0 through registry DNS. Do not disable version pinning or run a different pnpm against this installation. At execution start, inspect whether the pinned binary is already cached; use it if available. If unavailable, request normal sandbox network escalation for that precise package-manager resolution if necessary; do not reinstall dependencies or change the lockfile merely to write/run this feature. Record blocked commands honestly if resolution remains unavailable.

Use installed APIs and local type definitions first. No framework API changes are required by this plan. Browser fixture boot/listen signatures must be checked against installed versions before writing the fixture.

## Execution ledger

Status: **Approved by user; native execution started.**

| Task | State | RED evidence | GREEN/verification | Deviations |
| --- | --- | --- | --- | --- |
| 1 Public/private contracts | Pending approval | Not run | Not run | None |
| 2 Test scope/transaction | Pending approval | Not run | Not run | None |
| 3 Front cast/action | Pending approval | Not run | Not run | None |
| 4 Reverse/interruption | Pending approval | Not run | Not run | None |
| 5 Room/privacy | Pending approval | Not run | Not run | None |
| 6 Browser fixture | Pending approval | Not run | Not run | None |
| 7 UI/browser | Pending approval | Not run | Not run | None |
| 8 Review/verification/docs | Pending approval | Not run | Not run | None |

## Plan self-review

Spec coverage: physical/front privacy and strict input map to Tasks 1/5; test modifiers, final dice and transaction guarantees to Tasks 2/4; recipient ownership, component accounting and round reset to Task 3; both reverses/loss/defeat to Task 4; restoration/multiplayer to Task 5; isolated seeded browser coverage and keyboard/reconnect UX to Tasks 6/7; documentation, one final reviewer and required checks to Task 8. All five Review Focus cases have owning tests.

Resolved implementation ambiguities: reserve action until completion instead of advancing on cast start; require checkpoint-capable contexts only for new Spell paths; return errors from Spell test completion rather than silently dropping them; retain usage privately after discard; omit optional reverse messages because existing owner decisions suffice; guard unsupported protection before rolling; keep browser fixture outside production imports/build; add schema/client adapter fields explicitly. Exact hidden copy mapping stays in server code/tests, derived from verified catalog/crops.

Task 6 independently proves fixture isolation and seeded held-front/reload behavior before Task 7 adds casting UX assertions. All tasks preserve native execution and the separate plan-approval gate. This plan is documentation only; no implementation or test success is asserted.
