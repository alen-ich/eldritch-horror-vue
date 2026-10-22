# Location binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline.

**Goal:** Reject corrupted Location continuations before authoritative work.
**Architecture:** Pure shared validator at engine and room restore boundaries.
**Tech Stack:** existing TypeScript and Vitest3.2.7, Colyseus0.18; no new packages/APIs.
**Spec:** docs/superpowers/specs/2026-10-22-location-binding-design.md

## Global Constraints
Preserve unrelated dirty files. Save their exact already-applied deltas as patch, not whole-file staging. No worktree, push or merge.

## Task 1: Pure binding and engine integration
Create packages/engine/src/location-continuation-integrity.ts exporting validateLocationContinuationState(state:GameState,content:GameContent):string|undefined and packages/engine/test/location-continuation-integrity.test.ts. Modify dirty index.ts import/export, pre-command guard and direct draw guard.
- [x] RED: all four valid families/JSON; corrupt reveal/orphan/top/phase/owner/catalog/foreign metadata; moved owner and colleague decision accepted; unrelated families unaffected; invalid command/direct draw preserve state and RNG and suppress private IDs.
- [x] Run node node_modules/vitest/vitest.mjs run test/location-continuation-integrity.test.ts from packages/engine; confirm missing behavior.
- [x] GREEN implement generic pure binding check and guards before effects.
- [x] Repeat focused/full tests; expected exit0.

## Task 2: Room restore and verification
Create apps/server/test/LocationBinding.test.ts registration function; modify dirty GameRoom.ts restore guard before mutation and dirty GameRoom.test.ts registration.
- [x] RED real two-peer fixture with orphan reveal accepted; assert restoration rejection before public/private mutation and no hidden order on wire.
- [x] GREEN invoke validator before restoration; run server integration.
- [x] One clean-context independent reviewer; material findings RED→GREEN, minor findings ledger.
- [x] Run pnpm lint, typecheck, test, build; serial pnpm test:e2e --workers=1, Norman and Spell configs. Expected exit0.
- [x] Update docs/architecture/location-binding.md; save exact dirty-file patch, reverse-check it and whitespace; scoped commit of new module/tests/docs/patch only.

## Review Focus
Canonical vs catalog orphan IDs; moved investigator; colleague-owned decision; legacy partial fixtures; direct entry bypass. Each is covered in Task1; room atomicity in Task2.

## Ledger
Self-review complete and plan self-approved. HEAD01a9550. User explicitly selected inline/current branch and self-approval. Shared interface Task1→Task2: exported validator, same signature. Root cause: Location checks only completion top; restoration lacks binding validation. Existing Research pattern provides reference.

Task1: RED12/15 with no-op validator after missing-module baseline; GREEN28/28 including existing Location randomness. Initial test-file write used package cwd incorrectly, corrected before RED. Task2 server RED: missing expected exception in real two-peer restoration.

Ruling: full suite found existing spell-guards restored fixture missing reveal/top/catalog. Complete that initially clean fixture instead of weakening validator, preserving SPELL_EFFECT_UNSUPPORTED assertion. Cost: explicit synthetic card content in that test.

Ruling: server full suite exposed diagnostic precedence for a Research reveal paired with generic Location continuation. Keep existing Research validator before Location validator; both remain before mutation. Existing regression requires Research diagnostic.

Independent clean-context reviewer: no material findings;24/24 focused tests passed. Minor deferred: explicit room valid-binding/top-mismatch cases; pure validator covers those, room orphan rejection is exercised on two real peers. Final lint/typecheck/build exit0 (5/5 each), test exit0 (8/8): engine1472, content127, protocol21, server301. Playwright serial main7/7 and Norman2/2 passed; Spell result appended below. Patch uses zero context to avoid blank-context whitespace issues; reverse-check requires --unidiff-zero. Three pre-existing dirty integration files remain unstaged; new files and initially clean Spell fixture committed normally.

Final Spell2/2 exit0; all11 browser cases passed sequentially. Task1 and Task2 complete. Finishing: keep current branch and local commit as explicitly requested; no merge/push.
