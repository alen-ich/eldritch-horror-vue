# Initial snapshot command readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Suppress game intents until the attached room's snapshot identifies the local seat.
**Architecture:** Reuse playerId computed by syncState at the existing send boundary.
**Tech Stack:** SDK 0.18.2, Vue, TypeScript, Mocha; Playwright 1.63.0. No dependencies added.
**Spec:** docs/superpowers/specs/2026-10-22-initial-snapshot-command-design.md

## Global constraints
Current directory and branch; preserve unrelated edits. No commits, push, merge or deploy. Server retains authority; no private-state or protocol change.

## Review focus
Empty schema; other player's snapshot; legitimate version zero; late callbacks after replacement; own-seat removal. Each is covered in Task 1.

### Task 1: Initial snapshot send boundary
Files: apps/web/app/composables/useGameRoom.ts; apps/server/test/RoomSnapshotIsolation.test.ts.
Interfaces: existing send(command: GameCommand): void and syncState(state: ClientGameState); existing fake Room callback map and sent transport list.
- [x] RED: add real-composable regression cases for empty/other-seat snapshots preserving errors, version-zero own seat permitting one explicit send without replay, replacement/stale callbacks and own-seat removal. Run `pnpm --filter server exec mocha -r tsx test/RoomSnapshotIsolation.test.ts --exit`; expect unwanted command assertion failures.
- [x] GREEN: require nonempty playerId in send before error reset or transport send; rerun focused tests, expect all pass.
- [x] Document scope in docs/architecture/vertical-slice.md and docs/exec-plans/base-game-rules-implementation.md.

### Task 2: Independent review and verification
- [x] Fresh-context reviewer examines scoped code/tests/spec/plan. Reproduce material findings RED then fix GREEN.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm exec playwright test --config playwright.norman-action.config.ts`, `pnpm exec playwright test --config playwright.spell-casting.config.ts`. Record actual outputs and limitations.
- [x] Review scoped diff, run `git diff --check`, rename chat to outcome and report.

## Self-review and execution journal
Acceptance maps to Task 1; existing interfaces agree. Self-approved under user delegation. Native inline execution selected by user. Ledger kept here instead of shell-specific skill helpers; no commits permitted. Preflight: verification consumes Task 1 files; no interface conflict.

- Task 1 complete: RED produced two `1 !== 0` unwanted-command failures; GREEN passed all 6 real-composable cases. Root cause verified in installed SDK: JOIN_ROOM resolves before separate ROOM_STATE. No new framework API used.
- Environment ruling: default pnpm launcher stalled; use existing `.superpowers/pnpm.cmd` cached 10.28.0 launcher via PATH. No manifest or lockfile changes. Default launcher yielded no test result and is not counted as RED.
- Independent clean-context reviewer: no actionable findings; SDK lifecycle and version-zero behavior checked, focused suite independently 6 passing. No repair round needed.
- Root lint: exit 0, 5/5 tasks. Typecheck: exit 0, 5/5. Build: exit 0, 5/5. Test sandbox run: exit 173 with local MatchMakeError/fetch failures; permitted localhost rerun: exit 0, 8/8 tasks, 263 server cases. Existing Turbo output warnings remain.
- Scope ruling: new timing cases use the actual composable with simulated transport; no new Playwright outage fixture. Existing browser configurations provide ordinary integration coverage.

- Browser verification: default Playwright 6/6, Norman action 2/2, Spell casting 2/2, each exit 0. Existing NO_COLOR/FORCE_COLOR warnings only.
- Installed versions inspected: Node 22.19.0, Colyseus 0.18.5, schema 5.0.32, SDK 0.18.2, Nuxt 4.5.2, Vue 3.5.42, Vitest 3.2.7, Playwright 1.63.0. No dependency changes.
- Task 2 complete: scoped diff and initial inventory compared; unrelated working changes preserved. git diff --check passed with existing line-ending warnings. Branch master and HEAD 9c16ea6 unchanged. Finishing decision: keep in place as explicitly requested; no commit, push, merge or deploy. Chat renamed to the implemented outcome.

