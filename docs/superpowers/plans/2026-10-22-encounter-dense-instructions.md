# Dense encounter instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline.

**Goal:** Reject sparse generic instruction arrays before effects.
**Architecture:** Existing pure parser recursive validation with dense traversal.
**Tech Stack:** TypeScript/Vitest3.2.7; no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-22-encounter-dense-instructions-design.md

## Task1 RED→GREEN
Modify clean packages/engine/src/encounter-instructions.ts, create packages/engine/test/encounter-dense-instructions.test.ts. Interface unchanged parseLocationEncounterInstruction(value:unknown,depth=0):LocationEncounterInstruction|undefined.
- [x] RED sequence/choice holes root/nested, undefined/null/JSON, valid dense and empty controls, real Location draw rejection without state/RNG use.
- [x] Run node node_modules/vitest/vitest.mjs run test/encounter-dense-instructions.test.ts from packages/engine; expect actual acceptance failure.
- [x] GREEN dense traversal retaining recursive validation; focused/full engine pass.

## Task2 review and save
- [x] One clean-context reviewer; material findings RED→GREEN and minors ledger.
- [x] pnpm lint/typecheck/test/build (includes actual multiplayer); serial main Playwright --workers=1, Norman and Spell configs; expected exit0.
- [x] docs/architecture/encounter-dense-instructions.md, ledger and diff-check; scoped local commit only initially clean/new files. No push/merge/worktree.

## Review Focus
Choice with all holes; mixed sequence; conditional nested input; empty sequence vs empty choice; JSON hole→null representation. Task1 owns all.

## Ledger
HEAD767b48d, previous marker-binding iteration complete. Current generic parser code independently confirms map skips holes after Research-only correction. Spec/plan self-reviewed and self-approved. No shared new interfaces, inline current branch authorized.

RED6/12: four sparse root/nested arrays, entirely sparse choice and actual Location acceptance. Null/undefined and dense controls passed before implementation. GREEN changes traversal only; no dirty integration source touched.

GREEN519/519 focused. Independent clean-context review: no material findings,519/519 independently passed. Minor explicit valid-nested control deferred; broad existing compatibility coverage passes. Root lint/typecheck/build5/5 each exit0; test8/8 including304 real server tests. Browser configs run serially. No dirty prerequisite files changed or staged.

Final root counts:1525 engine,127 content,21 protocol,304 server. Main Playwright7/7 exit0. Existing hourly automation updated in place to the latest completed foundations/current ledger; schedule and ACTIVE status retained. No new automation.

Final Norman2/2 and Spell2/2 exit0, all11 browser cases passed sequentially. Tasks1–2 complete; no product deviations. Minor nested-valid control coverage remains explicitly deferred. Scoped local commit on current branch; no push/merge.
