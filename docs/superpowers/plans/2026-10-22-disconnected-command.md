# Disconnected command boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Prevent new game commands entering a disconnected or pending transport.
**Architecture:** One guard at the common composable send boundary; existing connection lifecycle supplies status.
**Tech Stack:** installed SDK 0.18.2, Vue, TypeScript, Mocha, Playwright; no new dependency.
**Spec:** docs/superpowers/specs/2026-10-22-disconnected-command-design.md

## Global constraints
Current branch/directory. Preserve pre-existing changes. No rules/protocol/private-state changes, commits, push, merge or deploy.

## Review focus
Idle without room; dropped then reconnected room; final leave; pending/failed matchmaking retaining old snapshot; obsolete callback changing current status. Assert blocked sends preserve errors and never replay.

### Task 1: Outgoing command boundary
Files: modify apps/web/app/composables/useGameRoom.ts and apps/server/test/RoomSnapshotIsolation.test.ts (reuse actual composable harness).
Interfaces: existing send(command: GameCommand): void; transport Room.send(type, envelope); currentRoomCallback status callbacks unchanged.
- [x] RED: record sent transport messages and lifecycle callbacks in existing fake Room; expose send/status and deferred connection in harness. Test all review conditions and versioned resumed send. Run pnpm --filter server exec mocha -r tsx test/RoomSnapshotIsolation.test.ts --exit; require assertion failure from unwanted game sends.
- [x] GREEN: return before error reset/Room.send unless room exists and status is connected. Repeat focused command.

### Task 2: Review and verification
- [x] Update docs/architecture/vertical-slice.md and docs/exec-plans/base-game-rules-implementation.md with scope and limitations.
- [x] Independent reviewer with clean context reviews scoped changes, spec and tests. Reproduce material findings as failing tests before fixes.
- [x] Run pnpm lint, pnpm typecheck, pnpm test (includes multiplayer), pnpm build, pnpm test:e2e, pnpm exec playwright test --config playwright.norman-action.config.ts and pnpm exec playwright test --config playwright.spell-casting.config.ts.
- [x] Review diff and record actual results and deviations below.

## Self-review
Acceptance mapped to Task 1; no new interfaces or shared dependencies. Self-approved as authorized; execute inline.

## Execution journal
Preflight: extensive existing edits preserved, including the harness and composable. User explicitly permits self-approval and current branch execution. Plan journal replaces shell-specific workspace bookkeeping. No commits.

- RED: initial harness tried writing a readonly ref; corrected to establish errors through real failure/message callbacks. Then two failures reproduced missing guard: erased error and one unwanted command. GREEN: focused real-composable suite 4/4.
- Root verification: lint exit 0 (5 tasks); typecheck exit 0 (5 tasks); build exit 0 (5 tasks). Initial sandbox test exit 173 with localhost fetch failures; permitted loopback rerun exit 0, 261 server cases, 8/8 root tasks (6 cached).
- Execution uses installed cached pnpm 10.28.0 executable with its directory prepended to PATH, avoiding the previously observed launcher stall. No dependency versions changed.
- Independent clean-context reviewer: no actionable findings. Nonblocking coverage notes: pending/leave do not separately assert nonempty errors; create path represents shared send boundary rather than separate join/reconnect matchmaking tests. Deferred as no production defect was found. Reviewer's own pnpm attempt stalled and was interrupted; validation evidence is the completed executor runs.
- Browser: Norman action 2/2 exit 0; Spell casting 2/2 exit 0. First default run 5/6, Norman Acquire option visibility timeout. Isolated reproduction passed 1/1 without code changes. Full repeat passed 6/6, exit 0. Root cause of initial browser timeout remains unconfirmed; no unrelated test or product change made.
- Ruling: actual dedicated filename is playwright.spell-casting.config.ts; corrected plan typo. New outage boundary uses the actual composable with simulated SDK transport; existing Playwright covers real multiplayer/reload but adds no outage scenario.

- Final result: all planned tasks complete. Default Playwright repeat 6/6, Norman action 2/2, Spell casting 2/2; each exit 0. First default timeout remains recorded, not treated as a proven product defect. git diff --check exit 0 (existing LF/CRLF warnings only).
- Final diff inspected against initial inventory: only send guard, test harness/regressions, two new design/plan files and two scoped documentation additions belong to this task; other working changes preserved. Branch master, HEAD 9c16ea6 unchanged. Finishing-a-development-branch resolved as keep in place by user instruction. Chat renamed. No commit, push, merge or deploy.
