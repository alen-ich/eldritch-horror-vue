# Research authored binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline.

**Goal:** Reject pre-bound marker effects and sparse source sequences before Research execution.
**Architecture:** Narrow pure binder validation; runtime continuations retain existing schema.
**Tech Stack:** installed TypeScript/Vitest3.2.7; no dependencies or framework APIs.
**Spec:** docs/superpowers/specs/2026-10-22-research-authored-binding-design.md

## Task1 RED→GREEN
Modify clean packages/engine/src/research-instructions.ts; create packages/engine/test/research-authored-binding.test.ts. Interface unchanged bindResearchInstruction(value:unknown,markerId:string,depth=0):LocationEncounterInstruction|undefined.
- [x] RED table: bound gain/relocation in effects and optional cost; nested sequence/test/ambush/optional; sparse sequence; valid scan-authored target chooses server ID and no mutation. Engine draw rejects before input/state mutation.
- [x] Run node node_modules/vitest/vitest.mjs run test/research-authored-binding.test.ts from packages/engine; confirm actual acceptance failures.
- [x] GREEN reject runtime-only effects in authored arrays/cost; dense sequence traversal. Repeat focused and existing actual Research tests.

## Task2 review/verify/save
- [x] One clean-context reviewer, material feedback RED→GREEN; ledger minors.
- [x] pnpm lint/typecheck/test/build; server/headless included. Serial main Playwright --workers=1 then Norman/Spell configs. Expected exit0.
- [x] docs/architecture/research-authored-binding.md and ledger, diff-check and scoped local commit. No dirty integration files touched, no push/merge.

## Review Focus
Optional cost bypass; deep conditional branches; holes serialized as null; legitimate marker syntax; saved compiled continuation compatibility. Task1 tables cover all except saved compatibility, exercised by unchanged Research full suites.

## Ledger
HEAD daac0ce; source baseline clean. Spec/plan self-reviewed and self-approved, inline/current branch explicitly authorized. No shared new interfaces. Root cause: binder forwards raw effects to generic runtime parser and sequence map skips holes. This is a prerequisite to persisted marker provenance, not its completion.

RED12/16: ten nested/root prebound effects, sparse nested sequence and real engine draw incorrectly accepted. Optional-cost cases already rejected by the generic parser, so no redundant new cost guard is needed. GREEN changes only the effects trust boundary and dense sequence traversal. Additional heartbeat inputs resume this same iteration, not duplicate it.

Independent clean-context review: no material findings,83/83 passed. Applied minor test cleanup: unused imports removed, distinct board/held physical Clue tokens. No product fix pass required. Root lint/typecheck/build5/5 each exit0; root test8/8 exit0 with303 server. Browser verification in progress.

Final root test after minor fixture cleanup:8/8 tasks exit0,1503 engine,127 content,21 protocol,303 server. Main Playwright7/7 and Norman2/2 passed sequentially; final Spell run pending. Existing hourly automation updated in place to point to Location discard and this iteration, retaining its schedule/status and all scope/safety instructions; no duplicate automation.

Final Spell2/2 exit0, all11 browser cases passed serially. Tasks1–2 complete. Diff reviewed: source-only three-line behavior change plus new tests/docs; no pre-existing dirty files changed. Finish with authorized scoped local commit, keep branch, no merge/push.
