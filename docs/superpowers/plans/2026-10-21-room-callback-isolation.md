# Room Callback Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Prevent obsolete room callbacks from mutating the active client session.
**Architecture:** Guard callbacks before effects using current Room object identity; preserve private inbox ordering.
**Tech Stack:** TypeScript, Nuxt/Vue shallowRef, installed Colyseus SDK 0.18.2, Mocha, Playwright 1.63.0.
**Spec:** `docs/superpowers/specs/2026-10-21-room-callback-isolation-design.md`.

## Global constraints
Current directory/branch; preserve existing changes. No new dependencies, game rules, server/protocol changes, commits, push, merge or deploy. Self-approval authorized. No competing create/join arbitration or transport teardown.

## Review focus
Same ID/different connection; old private message after inbox clear; late leave/drop changing status; old seat token write; legitimate current reconnect. Task 1 tests each case.

### Task 1: Guard obsolete callbacks
Files: create `apps/web/app/game/current-room-callback.ts`, `apps/server/test/CurrentRoomCallback.test.ts`; modify `apps/web/app/composables/useGameRoom.ts`.
Interface: `currentRoomCallback<Args extends unknown[]>(isCurrent: () => boolean, callback: (...args: Args) => void): (...args: Args) => void`. Pure helper; no SDK dependency. Attach creates a typed local wrapper capturing the Room object and `room.value === nextRoom` predicate.

- [x] RED: callback side effects run for current room, stop after switching to a different object with same room ID, resume for current drop/reconnect; old state/errors/tokens/leave/private callbacks have no effect and cannot poison a newly cleared inbox. Existing Mocha runner: `pnpm --filter server exec mocha -r tsx test/CurrentRoomCallback.test.ts --exit`. Start with passthrough helper to observe actual assertion failures.
- [x] GREEN: guard callback invocation with current predicate; wrap all seven registered callbacks in attach before any effect. Keep initial synchronous sync and token request on newly attached room.
- [x] Focused tests and typecheck exit 0; inspect every event registration for missing guard.

### Task 2: Verify and document
Files: update `docs/architecture/vertical-slice.md`, `docs/project-owner-guide.md`, `docs/exec-plans/base-game-rules-implementation.md`, this journal.

- [x] Run root `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; real room tests included by server suite.
- [x] Sequentially run default `pnpm exec playwright test`, dedicated `pnpm exec playwright test --config playwright.norman-action.config.ts` and existing Spell config discovered from repository. Avoid shared test port contention.
- [x] Use requesting-code-review: one clean-context independent reviewer; material findings get failing regression then fix and relevant checks repeated.
- [x] Update status/limits and journal, `git diff --check`; keep changes uncommitted. Report actual checks, limitations and chat title.

## Self-review and approval
Acceptance mapped to guard tests and existing multiplayer/browser regressions; helper independent of SDK and no wire changes. Self-approved. Inline execution selected by user.

## Execution journal
- Initial: HEAD 9c16ea6, existing modified/untracked Norman/inbox work preserved. Skills brainstorming/writing-plans/executing-plans/TDD/systematic-debugging read. Journal kept here rather than Bash scratch scripts on Windows; no commits per user.
- Root cause: callbacks registered by old attach retain access to shared refs/inbox/storage. Guard by object identity before side effects; Room ref is shallow.

- Task 1 complete: passthrough scaffold produced two assertion failures (obsolete state/status/token and inbox pollution); guard made both pass. Existing inbox tests also pass: focused 4/4.
- Tooling deviation: default pnpm launcher attempts manager resolution; bundled pnpm 11 attempts a SQLite dependency check. Located cached pnpm 10.28.0 and used its directory at PATH front, without manifests/lockfile changes.
- Initial lint/typecheck caught missing optionCount in test summary; corrected fixture to the actual protocol type, both checks then exit 0.
- Root test sandbox run: engine 1264, content 104, protocol 21 pass; server 71 pass/173 fail due to SDK loopback fetch failed. Repeated identical pnpm test with loopback access: exit 0, server 244 pass, total 1633 tests. No game code change required.
- pnpm lint, pnpm typecheck and pnpm build exit 0. Existing Nuxt export deprecation/Rollup annotation, npm env config, Turbo output and color warnings are non-failing.
- Independent reviewer (one clean context): no material actionable findings, all seven callback registrations guarded before side effects. Focused tests 2/2 independently confirmed. Coverage limitation: helper/inbox tests simulate callbacks; actual composable wiring is inspected, not covered by a dedicated mocked composable test. Existing browser regressions cover current callbacks/reload.
- Ruling: retain current-object callbacks after onLeave and do not close old transports or arbitrate concurrent connection attempts — these are separate lifecycle policies outside the chosen stale-callback prerequisite. Cost: this slice does not certify those policies.

- Task 2 complete: default Playwright 6/6, Norman action 2/2, Spell casting 2/2; all exit 0, sequential local-server runs. Existing reload/private-recipient flows remain green. No new dedicated old-transport browser injection scenario; deterministic tests cover that condition.
- Final verification: lint/typecheck/test/build exit 0; 1633 unit/integration tests and 10 browser tests passed. git diff --check exit 0. Documentation updated; spec and plan self-reviewed/approved, independent review has no material findings. Existing user work retained, manifests/lockfile unchanged, HEAD 9c16ea6 on master.
- Finishing-a-development-branch: user's explicit instruction selects keeping all work in place; no integration menu, Git mutation or scratch cleanup. Chat renamed to identify connection/private-decision isolation.
