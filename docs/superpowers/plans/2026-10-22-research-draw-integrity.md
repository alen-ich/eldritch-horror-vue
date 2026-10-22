# Research draw inventory integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline with TDD and a final independent reviewer.

**Goal:** Refuse corrupt configured Research inventory before executing its top.
**Architecture:** Pure guard, integrated at the existing authoritative draw boundary.
**Tech Stack:** TypeScript, Vitest 3.2.7, Colyseus 0.18.5 / SDK 0.18.2; no installation.
**Spec:** docs/superpowers/specs/2026-10-22-research-draw-integrity-design.md

## Global constraints
Current branch/directory. Preserve and do not commit pre-existing edits. No new public data or effects. Specification/plan approval delegated by user.

## Review Focus
Sparse arrays; valid top with corrupt tail; cross-Ancient-One IDs; optional catalog compatibility; private IDs in errors. Task 1 covers all five.

### Task 1: Guard authoritative Research draws
Files: create packages/engine/src/research-draw-integrity.ts; modify packages/engine/src/index.ts; modify packages/engine/test/research-encounter.test.ts.
Interface: validateResearchDrawInventory(state: GameState, content: GameContent): string | undefined. Runtime type imports only; use validateResearchSetupCatalog. Return generic errors without IDs. Invoke before deck/top lookup; leave legacy behavior unchanged.
- [ ] RED: add cases with full32 setup catalog: missing, duplicate, foreign, wrong deck, sparse, extra, absent order and malformed catalog; assert ENCOUNTER_CONTENT_MISSING, immutable state and untouched deterministic dice. Valid orders for all four selections reach existing unsupported/success behavior. Legacy tests remain green.
- [ ] Run packages/engine/node_modules/.bin/vitest.cmd run test/research-encounter.test.ts from packages/engine; expect new corruption assertions to fail.
- [ ] GREEN: implement guard and call it before Research top lookup.
- [ ] Run same test and full engine suite; expect success.

### Task 2: Review, verification and record
- [ ] Run pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm test:e2e. If pnpm bootstrap fails, record actual failures and use installed local runners where practical.
- [ ] Dispatch one fresh reviewer with spec, plan and scoped diff. Reproduce substantial findings RED→GREEN.
- [ ] Document actual results, limitations and next dependency in docs/architecture/research-draw-integrity.md.
- [ ] Commit only this iteration's changes using scoped staging. Preserve unrelated edits.

## Self-review and journal
Spec coverage and interfaces checked; no task conflicts. Approved under delegated review. Preflight: one producer/consumer interface, signature above; no conflict. pnpm shim currently attempts registry resolution of 10.28.0 and fails DNS; local runner fallback under investigation.

Task 1: complete. RED: 8 failures/26 passes; GREEN 34/34. Full engine 1378/1378. Ruling: RNG assertion corrected to the actual rollDie API; cost if wrong: lost RNG-consumption coverage, directly covered by retained dice assertions.

Task 2: complete. Added apps/server/test/ResearchDrawIntegrity.test.ts and registered it in GameRoom.test.ts. Ruling: eleven synthetic short-deck room scenarios expanded explicitly to eight cards after full-suite failures; their rotation assertions cover the complete order. Cost if wrong: fixture order drift, caught by existing outcomes and exact rotation assertions. Ruling: room test shares existing boot lifecycle after independent boot failed in full suite; cost if wrong: integration isolation, covered by 295/295 server tests. lint/typecheck/build pass; pnpm test passes (295 server, 1378 engine, 127 content, 21 protocol). Playwright 7/7 serial; default parallel 6/7, initial guest roster timeout. Local pnpm executable and elevated local network access used. Final independent review: no substantial findings. Deferred minor: add configured supported-top success and unsupported-top-with-supported-tail coverage. Documentation: docs/architecture/research-draw-integrity.md. Preserve all pre-existing dirty work; commit records this iteration only and requires that existing workspace prerequisite.
