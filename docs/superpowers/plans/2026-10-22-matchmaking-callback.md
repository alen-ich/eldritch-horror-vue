# Matchmaking callback ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Prevent retained attachment events from superseding a newer connection intent.
**Architecture:** Module-local attachment-active flag in the existing composable callback/send guard.
**Tech stack:** Existing Vue/Nuxt/SDK/Mocha, versions inspected in previous iteration and unchanged; no package additions.
**Spec:** docs/superpowers/specs/2026-10-22-matchmaking-callback-design.md

## Global constraints
Current branch/directory. Preserve unrelated dirty tree and previous iteration. No commits, push, merge or deployment. Keep ledger here; user has approved self-review and inline execution.

## Task 1: RED to GREEN attachment intent isolation
Files: apps/server/test/RoomSnapshotIsolation.test.ts; apps/web/app/composables/useGameRoom.ts.
Interfaces: existing useGameRoom createGame(displayName), joinGame(roomId, displayName), reconnect(): Promise<boolean>, send(GameCommand); harness connect accepts an optional method discriminator and in-memory storage.

1. Extend harness Client to implement create/joinById/reconnect through its selected deferred result. Use Map-backed localStorage, returning storage for assertions.
2. Add create/join/reconnect parameterized regression: attach old Room; start deferred request; invoke old drop/reconnect/state/error/seat/private callbacks. Assert status connecting, original snapshot and saved credentials, no command. Reject latest; assert idle/latest error remains after old callbacks; then attach new Room, assert normal own-state send and old events ignored. Add no-token reconnect case proving an active room can still send.
3. Run `.superpowers/pnpm.cmd --filter server exec mocha -r tsx test/RoomSnapshotIsolation.test.ts --exit`. Expected RED: old events change connecting status or send a command.
4. Add `attachedRoomActive` module boolean. All real request starts set false before connecting; attach sets true. currentCallback requires active flag and exact room identity. send requires active flag too. Preserve no-token early return and snapshot/retirement semantics. Run focused command; expected all green.
5. Update docs/architecture/vertical-slice.md and docs/exec-plans/base-game-rules-implementation.md with precise boundary and exclusions.

## Task 2: Review and verification
One independent clean-context reviewer, read-only. Review Focus: each entry point, no-token return, failed replacement, stale callbacks, interaction with snapshot readiness and latest-request ordering. Reproduce significant findings RED then GREEN.
Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; pnpm test:e2e; pnpm exec playwright test --config playwright.norman-action.config.ts; pnpm exec playwright test --config playwright.spell-casting.config.ts. Expected exit 0; record actual output and sandbox constraints. git diff --check expected exit 0; inspect scoped changes against initial inventory. Update chat title.

## Self-review and ledger
Spec and plan self-approved: all acceptance cases map to Task 1; Task 2 consumes only its files. No interface conflict with previous snapshot iteration. Using executing-plans, TDD, systematic-debugging and verification-before-completion. Ruling: ledger remains in plan/current branch without commits per user; cost: evidence remains uncommitted.

- Task 1 complete: three RED failures showed actual connected instead of connecting across create/join/reconnect. GREEN 12/12 focused real-composable tests. No-token case already passed and remains protected. New tests cover pending and failed request events, retained state/credentials, eventual new attachment and old callback suppression. No production interface/package changes.
- Independent clean-context reviewer approved; no actionable correctness findings; focused suite independently 12/12. Minor (deferred): obsolete event helper does not explicitly invoke leave, although the same guard covers it. Minor (deferred): failure tests compare the retained error instead of asserting the expected literal; existing error path is unchanged. No material fix pass required.
- Root lint/typecheck/build all exit 0, 5/5 tasks each; root test exit 0, 8/8 tasks, 269 server cases using permitted localhost access. Existing Turbo output warnings remain. Main Playwright suite 6/6 exit 0. git diff --check exit 0 with line-ending warnings.
- Task 2 complete: Norman action browser suite 2/2 and Spell casting 2/2, exit 0. Existing Nuxt/color warnings only. Scoped changes reviewed against prior inventory; previous work preserved. Finishing decision: keep current branch and HEAD in place, no commit/integration. Next iteration investigates persisted reconnect credential freshness against installed server/SDK token rotation.
