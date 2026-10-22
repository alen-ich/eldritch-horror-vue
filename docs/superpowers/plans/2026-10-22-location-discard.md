# Location physical discard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline.

**Goal:** Correct physical Location draw/discard across all four families.
**Architecture:** Pure location-state.ts helper composed inside existing Location RNG transaction; public discard JSON follows Research projection pattern.
**Tech Stack:** TypeScript, Vitest3.2.7, installed Colyseus0.18.5/Schema5.0.32; no packages.
**Spec:** docs/superpowers/specs/2026-10-22-location-discard-design.md

## Global Constraints
Server authority and private order; exact dirty-file patch; no worktree/push/merge. Preserve pre-existing changes. Existing partial fixtures remain supported.

## Task 1: Engine physical zones
Create packages/engine/src/location-state.ts exporting validateLocationState(state:GameState,content:GameContent):string|undefined, removeLocationEncounterCard(state,content,context):string|undefined, finishLocationEncounterCard(state,content,context):string|undefined. Helpers mutate only caller clone; validation never mutates. Create packages/engine/test/location-discard.test.ts.
Modify dirty index.ts: optional locationEncounterSetup and locationDiscardIdsByDeck typed Partial<Record<LocationEncounterDeckId,string[]>>, nested public copy, catalog setup/init, pre-command/direct draw validation, removal before effects and finish instead of bottom cycle. Modify clean location-continuation-integrity.ts to accept validated removed active binding and preserve legacy top binding.
- [x] RED actual draw/JSON resume discards once, four-family recycle excludes active, singleton, legacy resume, malformed zones/shuffle rollback, nested projection copies.
- [x] Run focused engine tests from package cwd; expect assertion failures before implementation.
- [x] GREEN implement helper and integration; focused then full engine pass.

## Task 2: Public restoration and client
Modify dirty GameRoom.ts/schema/GameRoomState.ts/GameRoom.test.ts/useGameRoom.ts; create apps/server/test/LocationDiscard.test.ts; extend already-untracked RoomSnapshotIsolation.test.ts via patch.
- [x] RED real two-peer restoration with active removed card plus discard; reject duplicate/foreign/sparse/stripped-deck/stripped-active; assert no mutation, hidden order and reconnect. Client reset test.
- [x] GREEN JSON field projection/readback, restore validator before mutation, production physical catalog, readonly composable reset.
- [x] Run real multiplayer suite; expected exit0.

## Task 3: Review and save
- [x] One independent clean-context reviewer; material findings reproduce RED→GREEN, minors ledger.
- [x] pnpm lint/typecheck/test/build and sequential main Playwright --workers=1, Norman, Spell configs; expected exit0.
- [x] Update docs/architecture/location-discard.md, record actual results and deviations; save exact already-applied zero-context patches and reverse-check --unidiff-zero, diff-check. Commit only clean/new source/tests/docs/patch.

## Review Focus
Lethal completion, active card excluded on recycle, regional isolation, false removed flag, initialized-deck stripping. Engine tables own first four; server test owns last. Decision owner/current location remain independently permitted.

## Ledger
HEAD e5124e6. Spec and plan self-reviewed and self-approved. Inline current branch authorized. Baselines saved before own edits for six dirty integration files. Shared interface Task1→Task2: validator and discard record exported via engine, JSON only over Schema.

Task1 RED15/15. New fixture initially lacked lead investigator; supplied it after PLAYER_NOT_FOUND on completion. Existing clean Location/prevention tests assert old bottom-cycling: update to removed active card and faceup discard, retain lethal damage assertions. Regional RNG fixture reused general identities under regional deck: rename physical IDs to preserve its intended RNG rollback coverage. Task2 RED2/2: room readback dropped discard field; composable property absent.

Ruling: full root tests exposed five synthetic room fixtures that truncated Location inventory. Add explicit test-only catalog seeding and retain their desired top order rather than relax production conservation. Existing Research uses the same fixture pattern. Initial root lint/typecheck passed; tests failed5 here before correction.

Task1 and Task2 GREEN: full engine1487/1487; root test8/8 with content127, protocol21, server303. Root lint/typecheck/build5/5 exit0. One clean-context reviewer found no material issue; minor explicit gameResult regression deferred, shared completion covers it and existing lethal tests assert physical discard. Root final verification and browser results follow.

Review limitation: independent launcher pnpm hung with no output and was stopped; reviewer did not complete its own test run. Main direct-runtime full engine and root tests passed. Main Playwright7/7 exit0; dedicated configurations sequentially follow. Earlier Location architecture notes now point to this completed lifecycle, preserving historical text.

Final root lint/typecheck/build each5/5 exit0 after test-fixture corrections. Main browser7/7, Norman2/2 exit0; Spell config runs last. Patch reverse-check and diff --check passed. Completion awaits final browser result and scoped commit.

Final Spell2/2 exit0: all11 browser cases passed sequentially. Tasks1–3 complete. Finish on current branch with authorized local scoped commit; no push/merge. Next candidate audit: original Research marker binding (verify current code before design).
