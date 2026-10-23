# Expedition mechanical catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Record verified descriptive mechanics for all 18 Expedition fronts without enabling execution.
**Architecture:** Content-only strict catalog joined to existing physical scan/setup IDs.
**Tech stack:** Existing Zod4.6.5, TypeScript, Vitest3.2.7, no dependencies.
**Spec:** docs/superpowers/specs/2026-10-22-expedition-transcription-design.md

## Constraints and review focus
Current branch/dirty tree preserved; no commits/push/merge/deploy. Ledger here. Do not import catalog into GameContent/server execution. Review Focus: eight source images/all18 cards; Himalayas order and exceptional spawn/combat; Antarctica1 Will; prefix rewards/Conditions; Pyramids3 Health; exact source linkage; non-executable status.

## Task 1: RED to GREEN catalog validation
Files: packages/content/src/expedition-rules.ts (new); packages/content/test/expedition-rules.test.ts (new); packages/content/src/index.ts.
Interfaces: baseGameExpeditionRules readonly entries {id,locationId,number,sourceScan,sourceCellIndex,verification,effectStatus,initial,pass,fail}; initial {kind:test,skill,modifier,mechanics} or {kind:spawn_and_encounter_monster,mechanics}; pass/fail {mechanics,test:{skill,modifier}}. validateExpeditionRules(cards):void strict and complete/canonical.
1. Write tests for18/unique18/all non-executable, three per site and existing source mapping. Assert Himalayas1 spawn/2 Observation plus cells1/0, Antarctica1 pass Will, Pyramids3 pass failure loses1 Health, Amazon3 unconditional Artifact before Observation−1, Africa1 fail Health/Back Injury before Observation−1. Pin eight observed source SHA256 values. Corrupt skill, amount text, source, status, identity and missing entry; each must throw.
2. Run `pnpm --filter @eldritch/content exec vitest run test/expedition-rules.test.ts`; expected missing-catalog RED, then implement exact inspected mechanical summaries with explicit test metadata and strict validation.
3. Repeat focused test and full content test; expected all pass. Update docs/rules/base-game-token-encounters-and-artifacts.md and docs/exec-plans/base-game-rules-implementation.md. Existing readiness stays unchanged.

## Task 2: Independent review and verification
One read-only clean-context reviewer checks all source fronts and catalog against Review Focus; material discrepancies reproduced RED then corrected GREEN. Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; pnpm test:e2e; pnpm exec playwright test --config playwright.norman-action.config.ts; pnpm exec playwright test --config playwright.spell-casting.config.ts. Expected exit0, record actual results/limits; git diff --check exit0; preserve unrelated lines and rename chat to outcome.

## Self-review and ledger
Self-approved under user delegation. Task1 entry shape/source IDs consumed by Task2; no production interfaces change. Eight fronts inspected at original resolution before writing data. Ruling: descriptive summaries and test metadata are verification data, not a new executable DSL; cost: future handlers must explicitly translate verified entries. Current branch/inline ledger/no commit helpers per user.

- Task 1 complete: RED absent catalog module; GREEN focused17/17. All18 physical entries have explicit source cell/number, initial operation and both follow-up tests/mechanics. Eight SHA256 source checks pass. Himalayas numbering/combat, Antarctica Will, prefix ordering and Pyramids Health regressions pass. No engine/server import of executable Expedition rules added; existing scan statuses/readiness unchanged.
- Root lint/typecheck/build exit0 (5/5 each), root test exit0 (8/8 tasks): content127, engine1280, protocol21, server277. Engine/protocol outputs cached; content/server rerun. git diff --check exit0 with existing line-ending warnings. Browser suites and independent source review underway.
- Task 2 complete: independent clean-context reviewer inspected all eight original source images and compared every mechanic on all18 cards; no actionable findings. Focused tests independently17/17. Playwright default7/7, Norman action2/2, Spell casting2/2, all exit0. Existing Nuxt/color/Turbo warnings remain. Scoped diff reviewed, unrelated work preserved, current master/HEAD9c16ea6 unchanged; no commit/push/merge/deploy. Next iteration may implement a guarded lifecycle for the verified cards that require no Artifact reward or spawn/combat continuation.
