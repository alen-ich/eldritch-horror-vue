# Room snapshot isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Clear obsolete room presentation on successful replacement.
**Architecture:** Reuse empty syncState projection after publishing new Room identity and before retiring the predecessor.
**Tech Stack:** installed TypeScript, Vue 3.5.42, Nuxt 4.5.2, SDK 0.18.2, Mocha, Playwright.
**Spec:** docs/superpowers/specs/2026-10-21-room-snapshot-isolation-design.md

## Global constraints
Current branch/directory, preserve existing modifications, no packages or protocol/rule changes; no commit/push/merge/deploy.

## Review focus
No players in initial SDK state; late old callbacks; private pending data; failed matchmaking preserving current snapshot; stable reactive references.

### Task 1: Snapshot lifecycle
Files: modify apps/web/app/composables/useGameRoom.ts; create apps/server/test/RoomSnapshotIsolation.test.ts.
Interfaces: existing syncState(state: ClientGameState): void; attach(nextRoom: Room<unknown, ClientGameState>): void; public useGameRoom interface unchanged.
- [x] RED: real composable with Vue globals and fake SDK Client/Room boundary; assert successful replacement clears all returned room-derived refs, failure preserves them, stale callbacks ignored, new snapshot accepted. Run pnpm --filter server exec mocha -r tsx test/RoomSnapshotIsolation.test.ts --exit.
- [x] GREEN: remove syncState early return, default roster to [], project {} in replacement publish callback. Run focused test plus existing lifecycle tests.
### Task 2: Review and verification
- [x] Update architecture/status documentation; independent clean-context reviewer; reproduce/fix material findings using RED/GREEN.
- [x] Run pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm test:e2e and both dedicated Norman/Spell Playwright configurations.

## Self-review
Acceptance and five review conditions mapped to Task 1; no shared new interfaces. Self-approved.

## Execution journal
Preflight: HEAD 9c16ea6; extensive pre-existing changes preserved. Ruling: journal here instead of Bash workspace scripts on Windows. User authorizes self-approval, current branch and no commits.
- Task 1 RED: after correcting harness transpilation target from default ES5 to ESNext (Map iteration), regression failed with old players, active test, trade and board still present. GREEN: 15 focused tests passed. Harness uses actual composable/Vue with fake SDK transport and browser storage boundaries.
- Review: clean-context independent reviewer found no production defect; requested private inbox/same-ID and non-default field coverage. Added both; 2 composable cases pass. No material production finding requiring another fix.
- Initial lint/typecheck found missing getItem return annotation in test harness; fixed and removed explicit any from harness interface. Final lint/typecheck exit 0.
- Initial sandbox test had 173 localhost fetch failures; permitted loopback rerun passed: 259 server tests, root 8/8 tasks successful (other suites cached). Initial build failed EPERM writing Nitro output; permitted rerun exit 0.
- Ruling: use cached installed pnpm 10.28.0 executable and prepend its directory to PATH; normal launcher stalls. No dependency version changes.
- Browser initial sandbox run blocked readiness; concurrent permitted rerun encountered its occupied port. Stopped both owned sessions, verified no listener remained, restarted one sequential permitted browser suite.
- Final independent re-review: no remaining actionable findings after expanded privacy/default coverage.
- Final verification: pnpm lint exit 0; pnpm typecheck exit 0; pnpm test exit 0 (259 server cases, all 8 root tasks successful, 6 cached); pnpm build exit 0. Playwright default 6/6, Norman action 2/2, Spell casting 2/2, each exit 0. Actual command used pnpm exec playwright test --config <configuration>, equivalent to test:e2e for default config. git diff --check exit 0; existing line-ending warnings only.
- Limitation: new replacement race is verified through the actual composable with simulated transport, not a new browser replacement scenario. Existing real multiplayer/reload E2E suites pass. No new server rule or hidden-state wire changes.
- Task 1: complete. Task 2: complete. Finishing-a-development-branch resolved as keep-in-place by explicit user instruction. Branch master, HEAD unchanged 9c16ea6; no commit, push, merge or deploy. Chat renamed to room snapshot isolation. All unrelated existing edits preserved.
