# Norman Spell Reroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Native execution in the current session is already selected by the user; no implementation subagents.

**Goal:** Enable Norman's once-per-round payment of 1 Sanity instead of 1 Clue for a Feed the Mind test reroll.

**Architecture:** Extend the existing owner-only reroll decision, not the command set. A pure engine module owns eligibility and private per-investigator round usage; the existing Spell transaction owns atomicity and randomness rollback. Room snapshots preserve usage, and the web renders server options.

**Tech Stack:** TypeScript, existing Vitest/Mocha/Colyseus/Playwright. Installed stores: Colyseus 0.18.5, Schema 5.0.32, SDK 0.18.2, Nuxt 4.5.2, Vue 3.5.42, Vitest 3.2.7, Zod 4.6.5. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-21-norman-spell-reroll-design.md` — approved 2026-10-21.

## Global Constraints

- Current directory and branch (`master` at planning); no worktree, commit, push, merge or deploy.
- Preserve all pre-existing tracked/untracked Spell work. Before edits capture task baseline diffs for overlapping files and note them in this ledger; do not mistake the entire branch diff for this task.
- Pure engine; server-derived actor, strict versioned `RESOLVE_DECISION`; clients never supply payment amounts or random outcomes.
- Only Feed the Mind tests receive the new payment. No starting grants, other Spell implementation, other Clue substitution or Norman action.
- Cost: exactly 1 Sanity, leaving at least 1. A spend is not a loss; reverse losses retain existing defeat behavior.
- No private Spell copy IDs, reverse data, inventory order or ability ledger in public projection; owner choices stay targeted.
- One final independent reviewer with clean context; no per-task delegation. Use TDD and systematic debugging; finish all approved tasks without intermediate permission requests.

## Review Focus

1. Zero physical Clues still permits the Sanity option, but also makes Trish's unsupported aura applicable (Tasks 2/3).
2. Removing the usage ledger from a new snapshot must not restore the ability (Tasks 1/4).
3. Sanity 2 permits payment to 1; a subsequent reverse loss can defeat, without double action/payment (Task 3).
4. Failed RNG after payment must leave state and random queues untouched (Task 3).
5. Reload between selection and submission restores one live owner decision; retries cannot pay twice (Tasks 4/5).

## File map and interfaces

Create `packages/engine/src/norman-clue-substitution.ts`, with types and pure helpers:

```ts
interface PrivateInvestigatorAbilityUsage {
  schemaVersion: 1;
  normanClueSubstitutions: { playerId: string; investigatorId: "norman_withers"; round: number }[];
}
canUseNormanSpellReroll(state: GameState, playerId: string): boolean;
validateInvestigatorAbilityUsage(state: GameState): string | undefined;
spendNormanSpellReroll(state: GameState, playerId: string): boolean;
```

`canUse...` requires a living Norman with integer Sanity >=2, current `activeTest.playerId`, `continuation === "spell_cast"`, matching pending Feed the Mind source/caster, and no current-round Norman entry. It deliberately does not calculate other possession eligibility: the Spell applicability guard owns that. `spend...` rechecks, mutates only the provided transition clone, subtracts 1 and appends usage; returns false without mutation if unavailable. No RNG, version increment or events inside this helper.

Add optional `PrivateGameState.investigatorAbilityUsage` in `packages/engine/src/index.ts`; export the new types/validator there for the room. The optional shape is for legacy states, not permission to regenerate a missing new ledger. Initialize `{schemaVersion:1,normanClueSubstitutions:[]}` on new setup and first accepted Norman cast from a legacy state, before a decision can expose the option. Explicitly clone it in the manual `executeCommandImpl` private-state copy. `projectStateForPlayer` already removes privateState; add regression assertions.

Usage entries retain current-round evidence even after replacement/defeat; validate player seat, literal investigator, unique player/investigator pair, and exact current round. Reset entries on both existing round-reset paths beside `usedAssetRerollIds`; don't clear on turns, tests or inventory changes. No helper for arbitrary Clue spending is introduced.

Modify `spell-test-assets.ts` guard and `spell-casting.ts` legacy initialization; `index.ts` decision/payment/clone/setup/reset sites; `packages/protocol/src/index.ts` adds public fact `{type:"SANITY_SPENT_FOR_REROLL"; testId:string; playerId:string; dieIndex:number; amount:1}` to `GameEvent`. Never emit `CLUE_SPENT_FOR_REROLL` for this payment.

Server: `apps/server/src/rooms/GameRoom.ts` validates usage before any restoration mutation. Existing structuredClone of privateState carries it; no Schema field. UI: `apps/web/app/app.vue` already renders optionLabels and submits selections; retain that generic path, editing only if browser evidence shows a required change. No new endpoint or client amount field.

## Task 1: Private usage model and lifecycle

**Files:** new module above; modify `packages/engine/src/index.ts`, `packages/engine/src/spell-casting.ts`; create `packages/engine/test/norman-clue-substitution.test.ts`. Consume existing GameState/ActiveTest/pending Spell types; produce the interfaces above.

- [x] Record source provenance: inspect the supplied investigator PDF referenced by `docs/rules/base-game-investigators.md`, Reference Guide and official errata. Locate by document filename in workspace and user-supplied local materials; read only relevant pages. Record actual source/page/hash and verified payment rule in rules notes, without committing source PDFs. If unavailable locally, consult official published components/rules; if no authoritative ability source is accessible, report the precise missing source before implementing rule behavior. Do not invent a page number or use a community paraphrase as proof.
- [x] RED: tests `normanSpendLeavesOneSanity`, `rejectsUnavailableSubstitutionWithoutMutation`, `retainsUsageAcrossTestsAndSeatReplacement`, `validatesUsageLedger` assert Sanity 2→1, 1 unchanged/false, no other investigator, no other continuation, no duplicate use, rejection of wrong schema/round/seat/duplicate entry, and no public ledger.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/norman-clue-substitution.test.ts`; observe failures from missing functionality, not a broken runner.
- [x] GREEN: implement the three helpers, private type/exports, setup initialization and accepted-cast legacy initialization. Validator rejects missing ledger for a pending Norman cast; missing legacy ledger is allowed only when no such pending cast or `norman-sanity:` option exists. Ability check can treat an otherwise valid legacy state as unused so cast preflight can succeed, but actual payment requires initialized ledger.
- [x] RED: add command regressions that a normal transition's manual clone retains/detaches usage; `BEGIN_NEXT_ROUND` resets it; the other existing round-reset path does too. Assert changing active player and discarding/reacquiring a Spell does not reset it.
- [x] GREEN: wire clone/reset points with no new round counter; existing `turnNumber` is the authoritative round identifier. Run the focused file and `pnpm --filter @eldritch/engine typecheck`; expect exit 0.

## Task 2: Owner payment option and supported applicability

**Files:** `packages/engine/src/index.ts`, `packages/engine/src/spell-test-assets.ts`, `packages/protocol/src/index.ts`; extend `packages/engine/test/norman-clue-substitution.test.ts`, `packages/engine/test/spell-casting-fixtures.ts`; extend `packages/protocol/test/protocol.test.ts` only for wire-validation regressions. Consume Task 1 helpers; produce `norman-sanity:<dieIndex>` server option IDs and the event above.

- [x] RED: `offersSanityRerollWithoutPhysicalClues` starts Norman with conserved held Feed the Mind, zero Clues and Sanity 3. Assert cast accepted and one Sanity option per die. `offersIndependentPaymentMethods` gives a conserved physical Clue and asserts both `die-N` and `norman-sanity:N`; Sanity 1 offers no new option. Other investigators/continuations never get it.
- [x] Run the focused engine file and observe current Norman rejection.
- [x] GREEN: remove only the unconditional Norman guard, add options through `canUseNormanSpellReroll`, parse the new prefix distinctly from Assets and ordinary `die-N`. Retain existing membership/owner checks. Each accepted selection uses `spendNormanSpellReroll`, emits the new spend fact, rerolls through existing context, recalculates successes and rebuilds options; no physical Clue helper is called for that branch.
- [x] RED: `guardsTrishAuraWithZeroClues` co-locates living Trish and unused, affordable Norman; expect atomic `SPELL_EFFECT_UNSUPPORTED`. Check the same protection before initial roll and on resume. Trish at another space does not trigger it. Preserve existing normal-Clue guard and all Sanity-prevention/possession guards.
- [x] GREEN: applicability treats a potential Norman substitution as a Clue-like reroll for this unsupported interaction, including pre-test cast preflight where activeTest does not yet exist. Use explicit Norman/affordability/usage conditions there; do not incorrectly call the active-test helper to decide preflight applicability.
- [x] Verify focused tests plus `pnpm --filter @eldritch/protocol test` and `pnpm --filter @eldritch/engine typecheck`. Strict envelopes still reject extra client payment/result fields; no new command schema.

## Task 3: Complete casting, payment boundaries and rollback

**Files:** create `packages/engine/test/norman-spell-casting.test.ts`; extend `packages/engine/test/spell-random-transaction.test.ts`; use existing fixtures and both private test handlers. Modify production files from Tasks 1/2 only to fix reproduced failures.

- [x] RED: parameterize both physical copies; use initial/final dice to prove success, failure, final-four retention and discard. After payment, assert Sanity -1, identical physical Clue pools/count, one usage entry, one command version increment, no `CLUE_SPENT_FOR_REROLL`, and final result based on new dice. Finish target/improvement/reverse choices and assert exactly one action charged.
- [x] RED: `declineAndRealClueDoNotConsumeAbility`, `freeRerollAndSanityPaymentRemainIndependent`, `secondSanityPaymentIsUnavailable` exercise both payment orders, skip, normal physical Clue conservation, Foot/+1 effects and next test in the same round. Use existing supported Asset fixtures, not invented metadata.
- [x] RED: `spendThenReverseLossDefeatsNormally` pays 2→1 then resolves a loss branch; assert pending defeat and no later reward/action double charge. Payment itself emits no damage/defeat and invokes no loss-prevention path. Retain protection guards if held reactions would affect the later reverse loss.
- [x] RED: wrong owner/index/option, reused decision, unavailable Sanity and changed usage all leave state unchanged. RNG exception/invalid die and ID exhaustion after payment restore deterministic context checkpoint; retry with valid input matches a clean run, including events/usage/version.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/norman-spell-casting.test.ts test/spell-random-transaction.test.ts`; record each meaningful RED. Fix minimally; do not weaken tests or transaction boundaries.
- [x] GREEN verification: same command, then `pnpm --filter @eldritch/engine test`; all tests pass. Use systematic debugging for unexpected failures and log root causes.

## Task 4: Room restoration, authorization and privacy

**Files:** `apps/server/src/rooms/GameRoom.ts`; new `apps/server/test/NormanSpellCasting.test.ts`; register via `apps/server/test/GameRoom.test.ts`, following `registerSpellCastingRoomTests`. Consume engine validator and option/event contracts; export `registerNormanSpellCastingRoomTests(getServer: () => ColyseusTestServer<typeof config>): void` from the test module.

- [x] RED: two clients select Norman/Lily, start normally, then fixture internally grants Feed the Mind conservatively and uses deterministic dice. Only Norman receives Sanity option; guest selection rejected; expectedStateVersion mismatch/replay changes nothing. Public Sanity synchronizes once after payment.
- [x] RED: snapshot/reconnect before payment restores exact decision and after payment restores used limit. Exported/imported ledgers are detached. Removing ledger when room already has one, malformed entries, and pending Norman snapshots without ledger throw before any synchronized/private mutation. A legacy snapshot without ledger and without pending Norman cast is accepted only by a room without prior new ledger; its next accepted Norman cast initializes one.
- [x] GREEN: invoke validator before `projectPublicState` and all room assignments; explicitly reject ledger removal when current room has it. Reuse current privateState clone, no public field. Do not regenerate on rejection.
- [x] RED/GREEN: second room remains unchanged, non-owner traffic contains no new option IDs, public state/bundle has no ledger or hidden reverse/copy data. Existing Spell privacy assertions apply to new messages; owner option may contain only public die/payment facts.
- [x] Verify `pnpm --filter server exec mocha -r tsx test/GameRoom.test.ts --exit --timeout 15000 --grep "Norman Spell"`, then `pnpm --filter server test` and server typecheck; expect exit 0. Use suite title `Norman Spell` so the targeted command actually selects these tests.

## Task 5: Browser regression and fixture isolation

**Files:** `apps/server/test/fixtures/spell-casting-server.ts`, `tests/e2e/spell-casting.spec.ts`; `apps/web/app/app.vue` only if required; existing `playwright.spell-casting.config.ts` unchanged unless test discovery requires a correction. Consume server-generated option labels, existing generic reroll UI and fixture server; no production seeding.

- [x] RED: append a separate Norman/Lily browser case, keeping the existing Jim case. Seed Norman with zero Clues and stable passing dice in the fixture by selected investigator, not a new public selector/command. Assert held cast control, Sanity option, absence for guest, reload before submission, keyboard selection and `Use selected reroll` submit. Sanity drops once; option disappears; replay/reload cannot repeat payment. Finish supported casting choices and observe synchronized skill/resource outcomes.
- [x] Run `pnpm exec playwright test --config playwright.spell-casting.config.ts --grep "Norman"`; expect initial missing behavior if run before implementation, otherwise preserve the recorded engine RED and verify this browser contract against real clients.
- [x] GREEN: fixture branches only for Norman, retaining the existing Jim setup/expectations. Existing all-six dice and +1 Lore fixture yield the high-success optional improvement branch after reroll, so finish with Lily choice and decline. Existing app already displays arbitrary optionLabels; do not add client-side eligibility or a hardcoded Sanity amount mutation.
- [x] Verify both browser cases with `pnpm exec playwright test --config playwright.spell-casting.config.ts`, plus existing `pnpm --filter server exec mocha -r tsx test/SpellBackPrivacy.test.ts --exit --timeout 15000`. Confirm production imports/build exclude fixture code. No browser runs overlap Nuxt build/typecheck.

## Task 6: Documentation, verification and one fresh review

**Files:** `docs/rules/base-game-spells.md`, `docs/rules/base-game-investigators.md`, `docs/exec-plans/base-game-rules-implementation.md`, `docs/project-owner-guide.md`, this ledger. Consume completed implementation/test evidence.

- [x] Update only superseded statements: Norman's scoped Spell reroll payment works; action, other substitution contexts, starting Spell grant and other Spell kinds remain pending. Record verified source provenance and actual coverage; do not claim full-family readiness or acquisition support.
- [x] Run sequentially `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --filter server test`, `pnpm --filter server exec tsx scripts/verify-spell-back-privacy.ts`, `pnpm exec playwright test --config playwright.spell-casting.config.ts`, `pnpm test:e2e`. Capture exit codes/counts, unavailable commands and environment failures honestly.
- [x] If pnpm launcher again cannot resolve pinned 10.28.0 due DNS, inspect cache for that exact version; otherwise use normal sandbox escalation for that resolution. Do not change lockfile, pinning or installed dependencies as a workaround. Mark checks blocked if still unavailable.
- [x] Apply `superpowers:requesting-code-review`, then dispatch exactly one final reviewer with `fork_turns:"none"`, repository path, approved spec/plan, relevant file list, and captured task baseline. Reviewer is read-only and checks task delta against the already dirty starting tree, especially the five Review Focus cases.
- [x] Apply receiving-code-review/systematic-debugging for actionable findings; reproduce each significant bug with a failing test, fix, rerun targeted tests and affected final checks. Record deferred findings with reasons. A test rerun does not count as another independent review.
- [x] Apply verification-before-completion, inspect task delta and `git status`, confirm unrelated changes retained. Report actual results and deviations. No Git integration action.

## Execution ledger

Status: user approved the plan on 2026-10-21; Tasks 1–6 executed natively, including one independent review and test-verified fixes. Final results and E2E instability are recorded below. Product changes remain uncommitted by request.

| Task | State | RED evidence | GREEN / checks | Deviations |
| --- | --- | --- | --- | --- |
| 1 Usage/lifecycle/source | Complete | Missing helper module | 5 helper/lifecycle tests, typecheck | PowerShell ledger instead of unavailable bash helper; second reset site is setup |
| 2 Options/payment/applicability | Complete | 3 cast tests rejected Norman | Options and Trish guards pass; protocol 20/20 | Shared pre-test eligibility helper |
| 3 Full cast/rollback | Complete | Task 2 integration RED; added restored-choice RED | Both copies, payments, thresholds, defeat, RNG; full engine 1190/1190 before review fixes | Existing Spell guard defects fixed after regression failures |
| 4 Room/privacy | Complete | Missing snapshot validation | Norman room 3/3 after review fixes; full server 229/229 before added case | Deep clone existing continuations; preserve undefined keys in aliasing test |
| 5 Browser | Complete | Initial test exposed stale setup race | 2/2 focused Playwright | Existing generic UI and fixture need no change |
| 6 Docs/review/verification | Complete with recorded E2E limitation | Review engine 2 failures; room 1 failure | Final root checks pass; engine1192/server230; Spell browser2; full serial E2E4 | Separate marker/preflight; default parallel E2E remains flaky |

### Independent review and fixes

One reviewer with clean context examined the task delta against preserved baseline copies. It found two Important issues, no Critical issues. Both were independently reproduced with failing tests and fixed:

- At Doom 1 for a non-Azathoth game, Norman's payment could lower 3 Sanity to 2 and strand the cast at the existing unsupported-awakening guard. Preflight now includes the possible payment plus reverse loss; `rejectsTheCombinedPaymentAndReverseAwakeningBoundaryBeforeRolling` went RED→GREEN and proves no resource/RNG change on rejection.
- Removing the usage ledger after completed casting could be treated as legacy in a fresh destination. `PrivateGameState.investigatorAbilityUsageVersion: 1` is now persisted independently of the ledger, initialized at setup/accepted legacy Norman casts, cloned in transitions and checked by the validator. Stripped new snapshots reject in engine and a fresh room; both reproductions went RED→GREEN. The Task 4 existing-room-only rule was weaker than the spec; this marker is a necessary correction. Compatibility remains for genuine old snapshots without either new field, not cryptographic authentication of arbitrary snapshots.

Minor deferred: the original Norman room import-detachment assertion clears an already-empty usage array, so that particular assertion cannot independently detect aliasing. Actual room code deep-clones private state, export detachment is asserted, and the existing decision/dice snapshot test covers both boundaries. This test-strengthening suggestion is recorded without another implementation/review pass.

Reviewer declined to judge excluded starting grants, other substitution contexts, other Spell kinds and unrelated starting changes; these remain excluded as required. Parent-run broad verification supplies the final results. There is no second independent review after the test-verified fixes.

### Decisions and deviations

- PowerShell performs the skill's workspace/ledger bookkeeping because Git Bash fails `NtCreateDirectoryObject` in this sandbox. Preserve this task's baseline and logs because no commits are authorized; deleting them would remove review provenance. Cost if wrong: bookkeeping reproducibility, not gameplay.
- The second planned reset site is `START_GAME`, not a second new-round path. Initialize there and reset at `BEGIN_NEXT_ROUND`. Cost if wrong: incorrect usage reset; lifecycle tests cover the actual transitions.
- A shared potential-eligibility helper supports preflight before activeTest exists. Cost if wrong: inconsistent eligibility/aura checks; zero-Clue Trish and payment tests cover it.
- Existing failing Spell guards share the boundary now used by Norman: restore exact owner reroll choices, fail closed for applicable Leo/Lola/Silas, and allow only verified irrelevant, physically unique Kerosene/Pallid Mask. No general Artifact support. Cost if wrong: overblocking or an omitted applicable modifier; the existing failing cases now pass.
- Deep-clone existing private continuations on room import/export; correct the existing aliasing test's JSON-versus-undefined comparison with structuredClone. Cost if wrong: snapshot fidelity; full server regressions pass.
- The existing browser fixture already conservatively grants Feed the Mind for Norman; the generic UI already renders the server option. No product UI/fixture edits or production acquisition route were needed.
- Review fixes add an independent snapshot marker and include possible payment in awakening preflight, superseding the weaker planned compatibility check. Cost if wrong: legacy restoration compatibility or conservative overblocking; both boundary reproductions and legacy initialization are tested.

## Self-review

Spec coverage: ownership/resource/payment maps to Tasks 1–3; both copies, final dice and defeat to Task 3; shared round limit and legacy validation to Tasks 1/4; Trish to Task 2; room isolation/reconnect/privacy to Task 4; real browser owner flow to Task 5; docs, final fresh reviewer and required checks to Task 6. All five Review Focus cases have explicit assertions. Interfaces agree on `investigatorAbilityUsage`, current `turnNumber`, option prefix and event fields. The plan preserves existing generic UI, Spell transactions and independent component usage rather than duplicating them. Source verification remains a concrete execution prerequisite, not an invented rules citation. Plan approval was received before implementation.

## Final verification — 2026-10-21

| Command | Actual result after review fixes |
| --- | --- |
| `pnpm lint` | Exit 0; 5/5 tasks |
| `pnpm typecheck` | Exit 0; 5/5 tasks |
| `pnpm test` | Exit 0; 8/8 tasks; engine 1192, server 230, content 99, protocol 20 tests |
| `pnpm build` | Exit 0; 5/5 tasks |
| `pnpm --filter server test` | Exit 0; 230 tests |
| `pnpm --filter server exec tsx scripts/verify-spell-back-privacy.ts` | Exit 0; 228 text artifacts, reverse-image hash exclusion passed |
| `pnpm exec playwright test --config playwright.spell-casting.config.ts` | Exit 0; 2/2, including Norman reload/payment and existing recipient reload |
| `pnpm test:e2e` | Earlier pre-review run 4/4; after fixes two default parallel runs each 3/4. Existing Travel/Acquire and Personal Assistant scenarios timed out in different runs. No full-green claim for default parallel mode. |
| `pnpm test:e2e --workers=1` | Exit 0; 4/4 after final fixes |
| `git diff --check` | Exit 0 |

The Travel/Acquire failure trace contains a stale-state alert and waits for Keep all after Buy nothing; its test retries the discard but does not retry the purchase. The later Personal Assistant failure waits for its reroll option and has no stale-state alert in its trace; its exact cause is not established. Serial execution passes both. The original multiplayer test file is unchanged. Preserve this instability as a limitation rather than claim it fixed or attribute every timeout to one proven cause. Both failure logs/traces and serial results are in this plan's `.superpowers/sdd/2026-10-21-norman-spell-reroll/` workspace.

Nuxt devtools hook, NO_COLOR/FORCE_COLOR and Turbo missing-test-outputs warnings remain non-fatal. No pinned pnpm/network block remains; exact pnpm 10.28.0 ran successfully. Existing application limitations remain: no production starting Spell grant/acquisition, no other Norman payment contexts or action, and no full Spell-family support. Minor test-strengthening suggestion remains deferred as described above.

Twenty pre-existing unrelated tracked diff sections were compared byte-for-byte against the initial patch and preserved. Initial untracked work was not removed or replaced. No commits, pushes, merges, deploys or worktrees were created. Keep the current checkout and scratch provenance by user instruction.

