# Cthulhu Cultist Research implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Activate the verified normal Cthulhu profile for two authored Research sections through existing authoritative continuations.

**Architecture:** `named-ambush.ts` resolves `GameState`/`GameContent` primitives; `AncientSetup.normalCultistCombat` is optional; server maps verified content to it. Existing ordinary loss and Strength queue handle private lifecycle. No packages.

## Task 1 — engine RED→GREEN
- [x] New `packages/engine/test/cultist-research.test.ts`: card1 Wilderness/card7 City branches, no Will/loss-before-Strength, lethal loss, restoration/owner reroll/privacy, rollback, profile/AO/possession/prevention rejection and Monster conservation. Observe RED before implementation.
- [x] Modify clean `setup.ts`, `encounter-instructions.ts`, `research-instructions.ts`; add pure `named-ambush.ts`. Extend accepted named ID and label, normal profile interface.
- [x] Modify dirty `index.ts` only for shared stat resolution in preflight/expansion, Sanity loss queue and restored Cultist dynamic validation. Save exact already-applied delta patch against captured foundation; reverse --check.
- [x] Update clean existing `cthulhu-research.test.ts` section expectations to20, provide profile fixture, preserve old generic assertions by excluding new branches from old parameterized assumptions. Run focused engine tests from package cwd using `pnpm --filter @eldritch/engine exec vitest run ...`.

## Task 2 — server boundary RED→GREEN
- [x] Add new `apps/server/test/CultistResearch.test.ts` registering real-room tests; register from dirty `GameRoom.test.ts` via own patch. Prove missing mapping RED, then map primitives in dirty `GameRoom.ts`; save exact already-applied patch. Test loss once, Strength checkpoint JSON restore, guest rejection, private fields and physical pools.
- [x] Use existing Colyseus APIs only, inspect installed versions. Run focused Mocha grep then full multiplayer in root test.

## Task 3 — review and finish
- [x] One clean-context independent reviewer, reproduce/fix material findings through RED→GREEN.
- [x] Sequential pnpm lint/typecheck/test/build, default/Norman/Spell Playwright with loopback permission. Document actual results and limits.
- [x] Update new `docs/architecture/cultist-research.md`, link prior status, review diff, scoped commit clean/new files and exact patches only; preserve unrelated foundations. Rename chat and update existing heartbeat continuation.

## Approval and ledger
Plan self-reviewed and approved. Current directory/branch, no worktree. Logs/backups in untracked `.superpowers/cultist-research/`. No implementation started before spec/plan approval. All patches are already applied; must not be reapplied.

- Engine RED11/12, GREEN12/12 initially; extended boundary/rollback tests GREEN14/14. Existing focused combat/Research125/125 before extra cases. Final own suite15/15 after toughness regression below.
- Server fixture initially failed before reaching target due missing Spell inventory. Used existing createSpellInventory fixture convention; then meaningful RED2/2 (no Strength/defeat because profile absent). Added mapping; GREEN2/2 real loopback cases. Existing Colyseus0.18.14 APIs reused, TS5.9.3/Vitest3.2.7; no package additions.
- Initial root lint exposed as-const Ancient One union without normalCombat on other members. Replaced optional property access predicate with `"normalCombat" in ancient.cultist`; lint/typecheck passed. No content/compiler configuration change.
- Independent fresh-context reviewer `/root/review_cultist_research_live` passed47/47 focused tests and all three reverse patch checks. Found accidental UTF-8 corruption in two unrelated decision labels caused by Python's platform-default text decoding. Reproduced as RED9/87 using existing modifier tests plus an exact Puzzle Box label assertion; restored both original source lines byte-for-byte from captured foundation, regenerated patches with explicit UTF-8; GREEN87/87. Full test failure at that point was exactly eight existing arrow-label assertions; fixed together.
- Final self-review caught helper extraction omitting the existing `!player.defeated` predicate in printed-Monster per-investigator toughness. New regression RED1/15, restored original predicate, GREEN15/15. Reported to same reviewer. This preserves the old generic named-Monster behavior rather than expanding scope.
- Ruling: old parameterized Cthulhu tests retain their original18 generic test sections, with bind count updated20; new Cultist suite owns the two different branch shapes/profile fixture. Avoided duplicating profile setup in the old fixture. This is the only plan adjustment beyond review repairs.
- Scope: dirty `index.ts`, `GameRoom.ts` and test registration are saved only as exact already-applied patches against captured foundations. Clean source/test/docs changes are committed directly. Patch reverse checks pass. Prior untracked/dirty prerequisites remain necessary and outside the commit; full checks concern this working directory.
- Final sequential checks after all fixes: lint5/5, typecheck5/5, test8/8 (engine1670/content166/protocol21/server306, real multiplayer included), build5/5; Playwright default7/7, Norman2/2, Spell2/2. All passed. Existing Turbo test-output warnings, NO_COLOR/FORCE_COLOR and deliberate offline-test logging are nonfatal. Logs remain local in `.superpowers/cultist-research/`.
- Next orientation: remaining Cthulhu authored nodes include named Grotesque Statue/Ruby of R'lyeh rewards and Mists of Releh rewards. Inspect actual named Artifact supply guards and scan semantics before choosing the next minimal dependency; do not repeat Cultist implementation or expand generic combat/awakening automatically.
