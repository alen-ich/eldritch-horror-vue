# Pre-Strength Sanity loss implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, task by task.

**Goal:** Give the pure combat kernel the verified ordered loss needed by a future Cthulhu Cultist command slice.

**Architecture:** Optional primitive `StandardCombatInput.beforeStrengthSanityLoss`, default zero, validated eagerly. Reuse the existing defeat boundary after Horror and before Strength. No content imports or command activation.

**Tech stack:** Existing TypeScript5.9.3/Vitest3.2.7; no dependency additions. Current branch/directory as instructed.

## Task 1 — timing and compatibility (RED→GREEN)
- [x] Add `packages/engine/test/pre-strength-loss.test.ts`: normal/awakened numeric profiles, absent Horror, lethal/clamped loss without RNG, combined Horror loss, no Strength/no trigger, zero/default compatibility, simultaneous damage, frozen input.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/pre-strength-loss.test.ts`; observe assertions failing because the loss is ignored.
- [x] Change clean `packages/engine/src/combat.ts`: optional documented field; sum capped loss only when Strength exists; stop on Sanity defeat before roll.
- [x] Run focused combat tests and three Research suites.

## Task 2 — invalid timing input (RED→GREEN)
- [x] Add negative/fractional/NaN/Infinity and runtime string/null cases, assert no RNG call on rejection even with Horror present.
- [x] Observe failure, validate optional value as a nonnegative integer before any RNG, rerun focused suites.

## Task 3 — review, verification, record
- [x] One independent fresh-context reviewer examines spec, implementation and tests. Reproduce material findings as failing tests, fix and rerun.
- [x] Sequential `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (root Turbo test includes real server multiplayer); then `pnpm exec playwright test`, `pnpm exec playwright test --config playwright.norman-action.config.ts`, `pnpm exec playwright test --config playwright.spell-casting.config.ts` with loopback permission.
- [x] Update `docs/architecture/pre-strength-loss.md` and this journal with actual results/limits. Inspect diff and scoped commit only clean combat source, new tests/spec/plan/status. Preserve baseline dirty files.

## Self-review and approval
Approved under delegated approval after checking exact interface, files, timing and independently testable tasks. No worktree or further user approval needed.

## Execution ledger
Implemented and independently reviewed. Full command integration is intentionally deferred; all live Ancient One/possession guards remain authoritative. Existing `index.ts` exports combat automatically, so its dirty foundation need not be edited.

- Task1 RED:8 failed/2 passed; expected ignored loss and missing defeat. GREEN10/10 new timing cases,16/16 with existing combat.
- Task2 RED:6 invalid-input assertions failed/10 passed; GREEN16/16 new cases. Focused five-suite regression104/104.
- Independent reviewer `/root/review_pre_strength_loss`, fresh context, read-only: no actionable findings; independently ran22/22 combat cases. No corrections requested.
- Final sequential verification: `pnpm lint`5/5, `pnpm typecheck`5/5, `pnpm test`8/8 (engine1655, content166, protocol21, server304 including real loopback multiplayer), `pnpm build`5/5; Playwright default7/7, Norman2/2, Spell2/2. Logs in local untracked `.superpowers/pre-strength-loss/`. No command failures during final verification. Turbo reported its existing no-output-files warnings for test tasks; browser logs include existing NO_COLOR/FORCE_COLOR and deliberate offline-test warnings.
- No implementation deviations or packages added. Ruling: implement the explicitly permitted separately testable pure prerequisite before a live vertical slice, because the live path must retain interruptible loss/prevention, rerolls and restoration rather than calling the raw kernel wholesale. No gameplay/readiness promotion claimed.
- Scope: clean `combat.ts` changed directly; new test/spec/plan/status files plus a link in the previously clean profile status. Unrelated dirty/untracked foundations and secrets remain outside the commit. These full checks validate that existing dirty workspace, not a clean checkout of all its prerequisites.
