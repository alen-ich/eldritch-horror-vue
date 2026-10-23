# Automatic reconnect browser coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Verify actual automatic reconnect then reload preserves the same host seat.
**Architecture:** Observe native WebSockets and trigger the installed SDK's offline handler; existing local production server and web app.
**Tech stack:** Installed Playwright 1.63.0 websocket event, SDK 0.18.2, existing Nuxt/Colyseus. No new dependencies.
**Spec:** docs/superpowers/specs/2026-10-22-automatic-reconnect-e2e-design.md

## Constraints and interfaces
Current branch; no commits/push/merge/deploy; preserve all earlier work. New tests/e2e/automatic-reconnect.spec.ts auto-discovered by playwright.config.ts. Observe sessionId without replacing WebSocket; no product globals. SDK minUptime is 5000 ms and offline handler uses reconnectable CloseCode 4010, verified in installed source. Ledger stays in this plan.

## Task 1: Real integration regression
1. Add test: two contexts, host creates lobby, guest joins, host selects Akachi, guest Mark. Observe host game WebSockets at port 2567 and record only session ID. Ignore Nuxt HMR.
2. Poll minimum 5100 ms since confirmed connected UI, then dispatch offline to invoke real SDK closure with 4010. Assert new connection count, changed persisted token (boolean), same session/room, original local selection, host controls and two seats.
3. Reload host and assert the same identity/selection/roster. Select Cthulhu and assert guest sees aria-pressed true.
4. Run `.superpowers/pnpm.cmd exec playwright test tests/e2e/automatic-reconnect.spec.ts`; expected GREEN on existing corrected implementation. If transport harness fails, diagnose before modifying product code.
5. Temporarily remove only rotated-token microtask persistence from apps/web/app/composables/useGameRoom.ts; run targeted browser test expecting RED on token-change condition. Restore the exact implementation immediately, run targeted test GREEN. This is regression mutation proof, not a retained product change. Preserve every other line.
6. Update docs/architecture/vertical-slice.md and docs/exec-plans/base-game-rules-implementation.md to describe actual browser coverage.

## Task 2: Independent review and baseline
One fresh read-only reviewer. Review Focus: actual native socket closure; SDK uptime; same-seat assertions; token values not printed; cleanup; regression mutation proof. Material findings RED to GREEN.
Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; pnpm test:e2e; pnpm exec playwright test --config playwright.norman-action.config.ts; pnpm exec playwright test --config playwright.spell-casting.config.ts. Expected exit 0; record actual results. git diff --check expected exit 0. Scope includes only new browser test/docs; temporary production mutation must be fully restored.

## Self-review and ledger
Spec and plan self-approved. All acceptance maps to Task 1; no shared new production interfaces. Ruling: test-only iteration uses controlled mutation RED then restoration GREEN because behavior already exists; cost: temporary local omission while targeted verification runs, never committed. Existing ledger/current-branch adaptation remains in force.

- Diagnostic runs: initial click before Nuxt hydration left idle; use existing repository networkidle convention. Subsequent proxy attempt remained connecting; trace showed protocols[0]: expected string, got object before game WebSocket could connect.
- Ruling: replace proxy with synthetic browser offline notification invoking SDK Connection.ts's real native socket close. Cost: verifies transient notification/reconnect, not a full OS/network outage. Spec and plan amended and self-approved before proceeding; no product workaround introduced.
- Initial native scenario GREEN 1/1. Controlled mutation RED exit 1: expected rotated-token predicate true, actual false. Exact pre-mutation source restored in finally. A first mutation command refused to edit because of CRLF mismatch; no source changed in that attempt, then newline-tolerant exact-match replacement succeeded.
- Root lint/typecheck/build exit 0, 5/5 cached tasks each; root test exit 0, 8/8 cached tasks (272 server cases in cached output). No production changes retained in this test-only iteration.
- Task 1 complete: restored native targeted scenario GREEN 1/1 exit 0; mutation was caught at the intended token-change predicate and exact source was restored. No proxy code remains.
- Independent clean-context reviewer approved with no actionable findings. Reviewed RED/GREEN logs and native SDK closure semantics; did not rerun mutation/browser checks independently. Declined broader OS outage behavior and unrelated production code; those are explicit exclusions, not newly verified claims.
- Task 2 complete: full Playwright default 7/7, Norman action 2/2, Spell casting 2/2, all exit 0. Existing Nuxt/color warnings plus intentional SDK offline notification. Scoped diff checked; git diff --check exit 0 with line-ending warnings. Current branch/HEAD and all unrelated edits retained, no commit/push/merge/deploy.
