# Connection Request Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans; execute inline.

**Goal:** Only the latest connection request controls the browser.
**Architecture:** Shared pure coordinator wraps asynchronous SDK calls; composable supplies attach/error hooks and stale-room disposal.
**Tech Stack:** TypeScript, SDK 0.18.2, Colyseus 0.18.5/schema 5.0.32, Nuxt 4.5.2/Vue 3.5.42, Mocha, Playwright 1.63.0.
**Spec:** `docs/superpowers/specs/2026-10-21-connection-request-order-design.md`.

## Global constraints
Preserve existing edits; current branch/directory; no new package, server or wire behavior; no commits/push/merge/deploy. Self-approval authorized.

## Review focus
Old success after latest failure; stale reconnect rejection deleting current token; disposal rejection/throw; requests from different composable instances; no-token reconnect invalidating a real request.

### Task 1: Coordinator and integration
**Files:** create `apps/web/app/game/latest-connection-request.ts`, `apps/server/test/LatestConnectionRequest.test.ts`; modify `apps/web/app/composables/useGameRoom.ts`.
**Interface:** `createLatestConnectionRequest()` returns `run<T>(connect: () => Promise<T>, accept: (value: T) => void, reject: (error: unknown) => void, discard: (value: T) => void | Promise<unknown>): Promise<boolean>`. Return true only for accepted latest success, false for stale/failure. Keep generation in factory closure; instantiate once beside shared room refs. Ignore stale rejection, dispose stale success with caught cleanup errors. Wrap all three connection paths; reconnect token lookup remains before request start.

- [x] RED: deferred-Promise tests assert latest attachment in both completion orders; stale rejection leaves current error/token untouched; old success disposed after newest failure; rejected and throwing disposal contained; current rejection called; synchronous connect exception handled. Run `pnpm --filter server exec mocha -r tsx test/LatestConnectionRequest.test.ts --exit`.
- [x] GREEN: implement coordinator and integrate create/join/reconnect. Latest reject hooks retain existing status/token behavior. Stale room uses consented `leave()`. Run focused tests and typecheck.

### Task 2: Verification and review
- [x] Update `docs/architecture/vertical-slice.md` and `docs/project-owner-guide.md` with implemented boundary and exclusions.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` sequentially; full test includes real multiplayer. Run `pnpm exec playwright test`, `pnpm exec playwright test --config playwright.norman-action.config.ts` and Spell configuration. Run `git diff --check`.
- [x] One clean-context independent reviewer inspects only this slice against spec. Reproduce material findings with failing regressions, fix, rerun applicable checks.

## Self-review / approval
Spec requirements map to coordinator tests and all three integration paths. Shared module scope prevents instance-local arbitration. No-token reconnect cannot supersede. Plan self-approved; execute inline.

## Execution journal
- Preflight: HEAD 9c16ea6, existing extensive Norman/action/inbox/callback edits preserved. SDK source confirms `leave()` defaults consented and returns Promise. No manifest/lockfile edits required. Use this journal instead of skill Bash scratch/commit helpers on PowerShell; user prohibits commits.
- Task 1 RED: minimal unguarded async implementation reproduced old attachment/credential clearing and missing disposal: 5 failed, 1 passed. GREEN with request generation: 6/6 passed. Integrated one shared coordinator across all three SDK request paths.
- Lint found test callback variance (`assert.fail` cannot accept unknown); replaced with a zero-argument unexpected-callback helper. Final lint/typecheck exit 0. No production defect involved.
- Root test first run inside sandbox: SDK loopback `MatchMakeError: fetch failed` across 173 room cases. Same command with approved local network access exit 0: engine 1264, server 250, content 104, protocol 21 = 1639 tests; unchanged package suites reused Turbo cache. Server suite executed, including real two-client rooms.
- Independent clean-context reviewer: no actionable findings; focused tests independently 6/6. Minor opportunity deferred: direct composable overlap/no-token tests; shared module scope and no-token early return inspected, production browser regression covers normal reconnect. This is a coverage limitation, not a claim those races were exercised in a browser.
- Default Playwright exit 0, 6/6 including production two-browser room and owner decisions/reload. Dedicated action and Spell suites pending below.
- Build first run: client/server compilation succeeded, Nitro packaging failed with sandbox EPERM creating `.output/server/node_modules/vue-bundle-renderer`. Retry outside sandbox after browser suites to avoid concurrent Nuxt artifact writers.
- Ruling: preserve user changes and run checks sequentially where they share ports/artifacts. Cached pnpm 10.28.0 executable used through PATH because default launcher attempts registry access; manifests/lockfile unchanged.
- Final verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0. Build retry with approved permissions succeeded, confirming sandbox packaging restriction. Playwright default 6/6, Norman action 2/2, Spell casting 2/2 all exit 0. Existing npm/config/color/Nuxt/Rollup/Turbo warnings remain non-failing. `git diff --check` exit 0 (line-ending notices only).
- Final review: one independent clean-context reviewer, no actionable findings. No material fixes needed after review. Updated architecture, owner guide and implementation status. Branch remains master, HEAD 9c16ea6; all pre-existing changes retained, no commit/push/merge/deploy. Finishing-a-development-branch applied as keep-in-place per explicit user instruction; no integration menu or cleanup needed. Chat renamed to describe the resolved create/join/reconnect race.
