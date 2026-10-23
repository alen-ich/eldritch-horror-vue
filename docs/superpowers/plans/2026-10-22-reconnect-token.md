# Persist rotated reconnect credentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Save the SDK's rotated token after automatic reconnect without stale deferred writes.
**Architecture:** Guarded queueMicrotask in existing onReconnect callback.
**Tech stack:** SDK 0.18.2, core 0.18.14, Vue 3.5.42, Nuxt 4.5.2, supported browser queueMicrotask. No dependencies.
**Spec:** docs/superpowers/specs/2026-10-22-reconnect-token-design.md

## Constraints and interfaces
Current branch/directory, preserve unrelated and previous iteration edits; no commits or external publication. Existing currentCallback and attachedRoomActive own deferred writes. Harness Client.reconnect(token: string) records supplied credentials; VM context supplies native queueMicrotask. Ledger lives here.

## Task 1: RED to GREEN token persistence
Files: apps/server/test/RoomSnapshotIsolation.test.ts; apps/web/app/composables/useGameRoom.ts.
1. Inject queueMicrotask into VM and record reconnect token arguments in harness.
2. Add repeated reconnect regression: invoke drop/reconnect, rotate token to literal current:rotation-1 then current:rotation-2, flush microtasks, assert storage equals each literal. Explicit reconnect must receive current:rotation-2.
3. Add supersession regression: schedule old write, begin a newer deferred request before microtask, assert old rotation never persists; finish with replacement sharing room ID but a different token, assert its token persists. Cover latest request failure with old write still suppressed.
4. Run `.superpowers/pnpm.cmd --filter server exec mocha -r tsx test/RoomSnapshotIsolation.test.ts --exit`. Expected RED: storage retains original token.
5. Add guarded deferred persistence in onReconnect after readiness/status changes. Keep commandSnapshotReady invalid until fresh state. Run focused suite; expected all pass. Document in docs/architecture/vertical-slice.md and docs/exec-plans/base-game-rules-implementation.md.

## Task 2: Review and verification
One clean-context independent reviewer, read-only. Review Focus: SDK assignment after callback; repeated rotations; request starts before microtask; same-ID replacement; failed request; explicit reconnect token use. Reproduce material findings RED to GREEN.
Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; pnpm test:e2e; pnpm exec playwright test --config playwright.norman-action.config.ts; pnpm exec playwright test --config playwright.spell-casting.config.ts. Expected exit 0; record actual results/limitations. git diff --check expected exit 0; inspect scoped diff and update chat title.

## Self-review and ledger
Spec/plan self-approved: test assertions cover every requirement; no interfaces conflict. User selected native executing-plans, TDD, systematic-debugging and independent review. Ruling: keep ledger in plan and current branch without commits; cost evidence remains uncommitted. Installed core/SDK source inspected for exact assignment timing.

- Task 1 complete: RED retained initial token instead of the expected rotated credential. GREEN 15/15 real-composable tests, including repeated rotation, next explicit reconnect argument and supersession success/failure. Race-protection tests already passed before feature addition because no deferred write existed; they protect the new side effect. Documentation updated; no product dependencies or API changes.
- Fresh-context reviewer approved with no actionable findings; independently ran focused suite 15/15. Confirmed both SDK post-callback assignment and server token rotation. Review ruling: storage failure policy, multi-tab coordination and earlier dirty-tree behavior remain outside this credential-timing change; cost: no new guarantee for unavailable browser storage or multiple tabs.
- Root lint/typecheck/build exit 0 (5/5 each); root test exit 0 (8/8 tasks, 272 server cases) with permitted localhost access. Existing Turbo warnings remain. git diff --check exit 0 with line-ending warnings.
- Task 2 complete: Playwright default 6/6, Norman action 2/2, Spell casting 2/2, each exit 0; existing Nuxt/color warnings only. Scoped diff reviewed, unrelated work preserved. Finishing decision: keep current branch/HEAD and uncommitted changes in place as requested. Next iteration will add real-browser automatic reconnect then reload coverage, since current browser suites only cover explicit reload reconnect while timing is simulated in the composable suite.
