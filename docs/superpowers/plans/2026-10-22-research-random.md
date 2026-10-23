# Research random transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL superpowers:executing-plans inline with TDD and final independent review.

**Goal:** Failed Research preserves retained deterministic input.
**Architecture:** Family transaction helper around draw API and decision dispatch.
**Tech Stack:** Installed TypeScript/Vitest 3.2.7; no new package.
**Spec:** docs/superpowers/specs/2026-10-22-research-random-design.md

## Global constraints
Current branch/directory; pre-existing edits preserved; server authority and privacy unchanged; approvals delegated.

## Review Focus
Nested command/draw calls; paid reroll with late ID exhaustion; returned failures versus exceptions; successful retained-context consumption; optional checkpoint. Task 1 covers these.

### Task 1: Transaction boundaries
Create packages/engine/src/research-random.ts and test/research-random.test.ts. Modify index.ts to wrap resolveResearchEncounter via private resolveResearchEncounterImpl and RESOLVE_DECISION when pending Research.
Interface: withResearchRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult.
- [ ] RED direct/command partial dice exhaustion; paid reroll with ID exhaustion; wrapper all sequence kinds; success and no-checkpoint compatibility. Run engine vitest run test/research-random.test.ts, expect failures.
- [ ] GREEN mirror established Other World checkpoint commit/rollback/error sanitization. Preserve existing errors. Wrap decision before Norman-specific transaction dispatch so both ledgers roll back.
- [ ] Run focused and full suites, expect pass.

### Task 2: Verification and record
- [ ] pnpm lint, typecheck, test, build and test:e2e --workers=1 using established local executable/network permissions.
- [ ] One fresh review; substantial findings RED→GREEN. Update docs/architecture/research-random.md with outcomes and commit only iteration changes.

## Self-review and journal
Single producer helper consumed by draw and command dispatch; no signature conflicts. Approved. Existing workspace prerequisite remains outside commit.
