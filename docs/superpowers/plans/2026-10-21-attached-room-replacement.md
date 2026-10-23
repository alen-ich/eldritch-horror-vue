# Attached Room Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Release superseded attached transports safely.
**Architecture:** Pure synchronous replacement helper publishes new identity before best-effort asynchronous cleanup; useGameRoom supplies refs and SDK leave.
**Tech Stack:** TypeScript, SDK 0.18.2, Nuxt 4.5.2, Vue 3.5.42, Mocha, Playwright 1.63.0.
**Spec:** docs/superpowers/specs/2026-10-21-attached-room-replacement-design.md

## Global constraints
Preserve existing edits; current directory/branch; no new packages, wire/rule changes or commits/push/merge/deploy.

## Review focus
Synchronous leave callback must see new identity; rejection must be contained; hanging cleanup must not delay attach; initial/same object must not close current; failed/pending matchmaking must retain existing connection (existing request coordinator).

### Task 1: Replacement lifecycle
Files: create apps/web/app/game/replace-attached-room.ts and apps/server/test/ReplaceAttachedRoom.test.ts; modify apps/web/app/composables/useGameRoom.ts.
Interface: replaceAttachedRoom<T>(previous: T | undefined, next: T, publish: (value: T) => void, discard: (value: T) => void | Promise<unknown>): void.
- [x] RED: assert new identity is published before old disposal, each distinct predecessor disposed once; undefined/same ignored; throwing, rejected and never-resolving cleanup cannot block publication. Run pnpm --filter server exec mocha -r tsx test/ReplaceAttachedRoom.test.ts --exit.
- [x] GREEN: implement helper and replace room.value assignment in attach; use discardRoom calling leave(true). Run helper, CurrentRoomCallback and LatestConnectionRequest tests.

### Task 2: Verification
- [x] Update architecture and implementation status.
- [x] Run pnpm lint, pnpm typecheck, pnpm test, pnpm build, default Playwright plus playwright.norman-action.config.ts and playwright.spell-casting.config.ts (verify actual filenames).
- [x] Clean-context independent review; reproduce material findings with failing tests, fix, rerun relevant checks.

## Self-review
Every requirement maps to Task 1 tests or existing coordinator tests; no new server outcomes. Self-approved.

## Execution journal
Preflight: master at 9c16ea6, extensive pre-existing edits preserved. Journal kept here in place of Bash scratch tooling on Windows; no commits authorized.
- Task 1 RED: minimal publish-only helper yielded 1 expected failure (missing old-room disposal), 4 passing. GREEN focused lifecycle/request/callback suite: 13 passing. Test-edit typo caused ReferenceError in three cases during refinement; fixed after inspection, no production cause. Improved assertions to avoid swallowed assertions inside contained cleanup.
- Tooling: default pnpm launcher stalls resolving package-manager metadata; used existing cached pnpm 10.28.0 executable via PATH, no dependency changes. Installed versions inspected with pnpm list -r --depth 0.
- Review P2 confirmed: real SDK scheduled reconnect survives leave(true). Added apps/web/app/game/retire-room.ts and apps/server/test/RetireRoom.test.ts. RED: actual SDK backoff test observed one obsolete reconnect. Ruling: extend disposal to permanently disable reconnection and neutralize public connection.reconnect (scheduled timer ignores enabled in SDK 0.18.2); scope is retired Rooms only. Test fixture keeps SDK scheduling/leave real and replaces transport I/O only. Adapter also covers stale successful requests.
- Final review refinement also reproduced leave(true) rejecting on a CONNECTING socket. RED failed with socket-is-connecting; GREEN closes a non-open transport and resolves without sending. retireRoom returns Promise<unknown>. Focused suite now 15 passing; same reviewer rechecked adapter and tests: no remaining actionable findings.
- Post-fix pnpm lint and pnpm typecheck exit 0. pnpm test with localhost access exit 0: 257 server tests; engine/content/protocol unchanged suites served from Turbo cache. Initial sandbox run had 173 fetch-failed room tests, resolved by permitted loopback execution. No test failures suppressed.

### Task 1 review extension: Permanent SDK retirement
Files: create `apps/web/app/game/retire-room.ts`, `apps/server/test/RetireRoom.test.ts`; integrate in `discardRoom`.
Interface: `retireRoom(room: Room): Promise<unknown>`. Disable reconnection, neutralize the public reconnect entry point to cover the SDK's untracked retry timer, close non-open transports, otherwise consented leave. All cleanup stays behind the replacement helper/coordinator error containment.
- [x] RED/GREEN: real SDK queued backoff must make zero reconnect calls after retirement (RED 1, GREEN 0).
- [x] RED/GREEN: connecting transport must close once and never send (RED send rejection, GREEN success).
- [x] Existing current-room reconnect path remains unchanged; 15 focused tests pass.
- Playwright: default 6/6, Norman action 2/2, Spell casting 2/2; all exit 0 with local server/browser permissions. These cover production multiplayer/reload flows; retirement races are exercised at helper/SDK boundaries, not by a dedicated browser replacement scenario.
- Scope limitation: adapter targets installed SDK 0.18.2's public connection interface; review it when upgrading SDK. Disconnected old seats follow normal server timeout. Multi-tab arbitration and new game-rule coverage remain outside this change.
- Final post-fix pnpm build exit 0; git diff --check exit 0 (existing line-ending notices only). All required commands completed. Non-failing SDK/Nuxt/color/Turbo warnings retained in local logs under .superpowers/attached-room-*.log.
- Finished in master at unchanged HEAD 9c16ea6. Existing unrelated modifications retained; no commit, push, merge or deployment. Chat renamed to describe attached-room replacement. Finishing skill resolved as keep-in-place under user's explicit instructions.
