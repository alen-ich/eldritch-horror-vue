# Research continuation integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL superpowers:executing-plans inline, TDD and final clean-context review.

**Goal:** Reject inconsistent restored Research before accepting continuation commands.
**Architecture:** One pure validator shared by command dispatch and server restoration.
**Tech Stack:** Installed TypeScript, Vitest 3.2.7 and Colyseus 0.18.5; no install.
**Spec:** docs/superpowers/specs/2026-10-22-research-continuation-integrity-design.md

## Global constraints
Current branch/directory; preserve pre-existing edits; server authority and hidden data stay unchanged. Delegated approval.

## Review Focus
Colleague-owned prevention choices; post-effect movement; legacy partial fixtures; unsupported Gate/removed metadata; corrupt hidden tails. Task 1 tests these explicitly.

### Task 1: Validate before commands
Create packages/engine/src/research-continuation-integrity.ts and test/research-continuation-integrity.test.ts; modify index.ts import/export and executeCommand preflight.
Interface: validateResearchContinuationState(state: GameState, content: GameContent): string | undefined; consume validateResearchDrawInventory. No pending Research returns undefined.
- [ ] RED: valid roundtrip and each corruption named by the spec; executeCommand returns ENCOUNTER_CONTENT_MISSING with immutable state and retained rollDie input. Valid moved owner/colleague decisions remain accepted by the validator.
- [ ] Run engine vitest run test/research-continuation-integrity.test.ts; expect failure for missing validator.
- [ ] GREEN: implement pure validator and call at executeCommand entry before other handlers.
- [ ] Run focused and full suites, expect green.

### Task 2: Reject inconsistent server restoration
Modify apps/server/src/rooms/GameRoom.ts; extend registered ResearchDrawIntegrity.test.ts. Import exported validator and call before all applyEngineState mutations.
- [ ] RED: after full setup, create valid top-bound pending Research then corrupt top/reveal/owner/phase/tail; applyEngineState throws and retains both clients' public state plus exact prior private state. Valid JSON snapshot restores.
- [ ] GREEN: add server preflight, run targeted mocha via GameRoom.test.ts --grep 'Research draw physical integrity'.
- [ ] Run pnpm lint/typecheck/test/build and pnpm test:e2e --workers=1. Use installed pnpm executable/local network permission as established.
- [ ] One clean-context final review; substantial findings RED→GREEN. Update docs/architecture/research-continuation-integrity.md and commit only this iteration.

## Self-review and journal
Spec coverage/type signatures consistent. Preflight Task1 exports validator consumed by Task2 with identical signature; no conflict. Self-approved. Existing workspace prerequisite remains uncommitted and is not absorbed into this iteration.

Task 1 complete: RED missing validator; GREEN 12/12. Full engine 1390/1390. Test decision fixture corrected to real protocol schema during self-review; no product change.
Task 2 complete: RED room test missing expected restoration exception; GREEN full server 296/296, content 127/127, protocol 21/21. lint/typecheck/build exit 0. Final independent review: no substantive findings or deferred minors; reviewer test execution unavailable through pnpm shim, author results above. No scope deviations/rulings. Pre-existing edits preserved by staging own changes independently of unrelated file modifications.
Playwright: pnpm test:e2e --workers=1 passed 7/7 (1.1m).
