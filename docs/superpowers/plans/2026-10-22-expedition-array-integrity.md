# Expedition array integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Inline execution is explicitly requested.

**Goal:** Reject incomplete physical Expedition catalogs and shuffle outputs.
**Architecture:** Keep validation in the pure engine at existing setup boundaries; retain transaction errors and privacy.
**Tech Stack:** TypeScript, Vitest; existing Colyseus 0.18.5 and Playwright tooling for regressions.
**Spec:** docs/superpowers/specs/2026-10-22-expedition-array-integrity-design.md

## Global constraints
No new packages or network commands. Current branch/directory. Preserve unrelated edits. Only 18 canonical physical cards may pass validation.

## Task 1: Reject absent physical entries
Files: modify packages/engine/src/expeditions.ts; create packages/engine/test/expedition-array-integrity.test.ts. Tests reuse starting-spell-fixtures and spell-fixtures.
Interfaces: validateExpeditionSetupCatalog(cards: readonly ExpeditionSetupCard[], map: GameContent["map"]): string | undefined; initializeExpeditionDeck(cards, shuffle): {deck:string[], locationId:ExpeditionLocationId}; executeCommand unchanged.
- [ ] RED: sparse and explicit-undefined catalog must return EXPEDITION_CONTENT_MISSING before any shuffle or source mutation. Sparse shuffle must reject START_GAME with RANDOM_INPUT_REQUIRED and preserve source. Duplicate and foreign shuffle reject too. Valid reverse shuffle returns 18 cards with the_pyramids marker.
- [ ] Run `pnpm --filter @eldritch/engine exec vitest run test/expedition-array-integrity.test.ts`; expect sparse cases to fail.
- [ ] GREEN: materialize slots before predicates at catalog/shuffle boundaries, retain canonical checks and signatures.
- [ ] Run focused tests and `pnpm --filter @eldritch/engine test`; expect exit 0.

## Task 2: Review, verify and save
- [ ] One independent clean-context read-only reviewer inspects this patch, spec and tests. Reproduce material findings RED then fix GREEN.
- [ ] Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; pnpm test:e2e and dedicated Norman/Spell configs. Record actual exits.
- [ ] Update this ledger and implementation status document. Commit only scoped additions and a patch of the pre-existing untracked expeditions.ts; never stage the entire initial dirty tree.

## Review focus
Malformed shuffled first/last slots, explicit undefined entries, duplicate/foreign output, valid output marker, and checkpoint/source atomicity. Include corresponding test assertions in Task 1; reviewer additionally checks restoration and draw consumers.

## Self-review and ledger
Spec coverage and exact interfaces checked. Approved under user delegation.
Ruling: keep an inline ledger and manually scoped Git patch instead of commit-oriented workspace helpers because the existing dirty worktree must be preserved; cost if wrong is reduced helper automation, not altered product behavior.

- Task 1 complete: RED 4/13 failed (sparse catalog returned the wrong error after random use; sparse shuffle wrongly succeeded). GREEN 13/13, combined Expedition 50/50. Whole engine 1412/1412 through root test.
- Final review: one independent fresh-context read-only reviewer, no Critical/Important issues. Independently ran all three Expedition suites, 50/50.
- Final: minor (deferred): checkpoint stub proves rollback invocation but not stream restoration/no commit. Existing depleted-input setup test covers retained stream rollback; no production transaction changed here.
- Final: Ruling: hostile custom iterators/proxies remain outside the typed content/RNG contract; ordinary sparse and explicit undefined values are covered. Cost if wrong: such external objects would need a stronger boundary contract.
- Final: Ruling: unrelated dirty files and full gameplay readiness were outside the independent review; root checks and browser regressions are verified by the implementer. Cost if wrong: this patch review does not certify the pre-existing implementation.
- Verification: lint exit0 (5/5), typecheck exit0 (5/5), build exit0 (5/5). First root test in sandbox failed with 194 localhost fetch failures; focused test fails inside and passes outside sandbox. Authorized unrestricted rerun root test exit0 (8/8): engine1412, content127, protocol21, server296. Existing warnings: Turbo output declarations, Nuxt devtools/color.
- Playwright default7/7, Norman2/2, Spell2/2, exit0. Norman first attempt overlapped main Nuxt dev server and hit its lock; sequential retry passed. git diff --check exit0 and reverse patch check exit0.
- Ruling: expeditions.ts was already untracked; save this iteration's exact source delta as an already-applied patch plus new tests/spec/plan/status, leaving the original source file untracked. Reverse patch check passes. Cost if wrong: the commit depends on the pre-existing working-tree foundation and is not a standalone source implementation.
