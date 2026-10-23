# Reconnect snapshot readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Gate commands until automatic reconnect delivers synchronized own-seat state.
**Architecture:** Separate snapshot readiness from transport status and presentation sync.
**Tech stack:** SDK 0.18.2, Vue 3.5.42, Nuxt 4.5.2, Colyseus 0.18.5, Playwright 1.63.0; no dependency additions.
**Spec:** docs/superpowers/specs/2026-10-22-reconnect-snapshot-design.md

## Global constraints
Current directory and branch; preserve all unrelated edits. No commit/push/merge/deploy. Server remains authoritative. Keep execution journal here (Windows adaptation; no shell helper or cleanup of existing scratch).

## Task 1: Snapshot readiness RED to GREEN
Files: apps/server/test/RoomSnapshotIsolation.test.ts; apps/web/app/composables/useGameRoom.ts.
Interfaces: send(command: GameCommand): void; syncState(state: ClientGameState); existing Room callback map and real-composable harness. Add module-local readiness boolean; no exported API.

1. Add regression for drop -> reconnect -> private message -> state callback. Before state assert command count 0 and retained error; after own-seat state assert exactly one explicit command with expectedStateVersion 42. Repeat with version 0 and a second drop; other-seat state must block. Stale room callback coverage remains in existing suite.
2. Run `.superpowers/pnpm.cmd --filter server exec mocha -r tsx test/RoomSnapshotIsolation.test.ts --exit`. Expected RED: unwanted command count 1 instead of 0.
3. Invalidate readiness on attach/drop/reconnect/leave. Restore only on attached onStateChange while connected, or initial attachment's available state. Private-message sync must never restore it. Preserve own-seat check in send.
4. Repeat focused command; expected GREEN: all cases pass. Update docs/architecture/vertical-slice.md and docs/exec-plans/base-game-rules-implementation.md with the new scope.

## Task 2: Independent review and verification
Fresh-context reviewer reads spec/plan and scoped changes. Review Focus: private message before state; unchanged version; version zero; repeated drops; obsolete callbacks. Reproduce material findings RED then fix GREEN.
Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; pnpm test:e2e; pnpm exec playwright test --config playwright.norman-action.config.ts; pnpm exec playwright test --config playwright.spell-casting.config.ts. Expected all exit 0; record actual failures/limits. Run git diff --check and inspect scoped diff. Rename chat to outcome.

## Self-review and execution journal
Self-approved under user delegation: acceptance maps to Task 1; Task 2 consumes its files without interface changes. No spec gaps identified. Using executing-plans, test-driven-development, systematic-debugging and verification-before-completion.
Ruling: keep ledger in this plan and work in current branch, as requested; do not use commit-oriented shell helpers. Cost: history is working-tree documentation until user commits.

- Task 1 complete: two RED failures `1 !== 0` at versions 42 and 0, followed by GREEN 8/8 real-composable cases. Root cause verified in installed SDK JOIN_ROOM/ROOM_STATE handling. Existing initial attachment, replacement and callback isolation checks remain green.
- Fresh-context independent reviewer approved; no actionable findings. Focused suite independently 8/8. No fix pass required.
- Review ruling: unrelated dirty-tree behavior and broader game rules remain outside this iteration; retained existing queued messages/token rotation match explicit exclusions. Competing matchmaking lifecycle callbacks are a candidate for the next iteration and require separate reproduction. Cost: this change does not certify the entire connection lifecycle.
- Root lint and typecheck exit 0 (5/5 each). Sandbox test run exit 173: local MatchMakeError fetch failures. Permitted local-server rerun exit 0: 8/8 tasks, 265 server cases. Turbo output warnings remain.
- Task 2 complete: build exit 0 (5/5); Playwright default 6/6, Norman action 2/2, Spell casting 2/2, all exit 0. Browser logs include existing color-environment and Nuxt devtools warnings. git diff --check exit 0 with line-ending warnings. Scoped diff reviewed against initial dirty inventory; unrelated changes preserved. Chat renamed. Finishing-a-development-branch decision: keep current master/HEAD 9c16ea6 and all changes in place per user; no integration or commit. Next iteration begins with competing attached-room callbacks during matchmaking.
