# Location setup integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL superpowers:executing-plans inline.

**Goal:** Conserve physical Location catalog identities through all four setup shuffles.
**Architecture:** Strengthen existing pure setup boundary without interface or wire changes.
**Tech Stack:** installed Vitest3.2.7 and TypeScript, no new packages.
**Spec:** docs/superpowers/specs/2026-10-22-location-setup-integrity-design.md

## Task1 RED→GREEN
Modify packages/engine/src/setup.ts, create packages/engine/test/location-setup-integrity.test.ts.
Interface unchanged: buildLocationEncounterDecks(cards:readonly {id:string;deck:LocationEncounterDeckId}[],shuffle:<T>(items:readonly T[])=>T[]):Record<LocationEncounterDeckId,string[]>.
- [x] RED tests: sparse catalog, unknown deck, non-string/empty ID, missing deck (no shuffle consumed), duplicate/foreign/truncated/sparse shuffled IDs. Assert no source mutation; inspect generic errors (explicit private-ID assertion deferred below).
- [x] Run `node node_modules/vitest/vitest.mjs run test/location-setup-integrity.test.ts` from packages/engine; confirm genuine acceptance of corrupted data before fix.
- [x] GREEN preflight dense catalog and all four decks before RNG; validate exact output membership/count/density against retained original IDs, and pass a copy into shuffle. Add valid reversed/in-place output controls.
- [x] Repeat focused and full engine. Expected exit0, no existing fixture count changes.

## Task2 Review, verify, save
- [x] One clean-context independent read-only reviewer; material findings reproduced RED→GREEN.
- [x] pnpm lint/typecheck/test/build; root server/headless integration included; sequential full Playwright with one worker plus Norman/Spell configurations. Use documented bundled pnpm and authorized unrestricted localhost access.
- [x] Write docs/architecture/location-setup-integrity.md and this ledger. git diff --check; scoped local commit of clean setup.ts plus new tests/docs only. Save the required index.ts integration delta as an already-applied patch; no unrelated staging/push/merge/deploy.

## Review focus and constraints
In-place shuffle, sparse slots, complete preflight before random input, per-deck cross-contamination, legacy partial fixtures. All covered by Task1; reviewer additionally checks START_GAME error/rollback integration and authoritative privacy. Do not promote physical discard readiness.

## Ledger
Spec/plan self-approved. Initial HEAD a7e2125. Code confirms next physical-lifecycle prerequisite: catalogs currently skip holes and trust shuffle output; no new rules needed.

- Task1 RED11/15: sparse/malformed catalogs, absent-deck RNG use, malformed shuffle and shared output buffer aliasing. GREEN15/15 plus old setup9/9. Output snapshots prevent the shared-buffer defect in addition to conservation.
- Independent review: no blocking helper findings;24/24 independently passed. Reviewer qualified START_GAME conditional wrapper coverage and flagged a minor missing explicit private-ID assertion (generic messages verified by inspection).
- Final review fix: promoted conditional START_GAME coverage to required integration correctness. Two real bare-start regressions failed RED on escaped helper/deterministic-input exceptions. GREEN17/17 plus old setup9/9 after applying existing Location transaction independent of unrelated content features. Input state and partial shuffle input preserved.
- Minor deferred: explicit assertions that errors omit private IDs. Messages are generic on both author and reviewer inspection; no demonstrated leak. No second review dispatched; fix pass is verified through failing tests and final full suite.
- Ruling: index.ts already dirty, so preserve it through an exact already-applied patch rather than stage unrelated prerequisites. Cost if wrong: saved integration depends on the existing working-tree foundation and is not standalone. Task2 commit scope now includes this patch, not the whole index.ts.
- Final root lint/typecheck/build exit0 (5/5 each); root test exit0 (8/8): engine1457,content127,protocol21,server300. Full serial Playwright7/7 exit0; dedicated Norman2/2 and Spell2/2 exit0, sequentially (11 browser cases total). No product dependency installed or unrelated source changed.
