# Atomic Other World random input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline; use test-driven-development and systematic-debugging.

**Goal:** Preserve deterministic random sequences when an Other World transition fails.
**Architecture:** Existing EngineContext checkpoint transaction, one direct entry point and one resumed-command boundary. No public API or network changes.
**Tech Stack:** Installed TypeScript, Vitest 3.2.7, Colyseus 0.18.5, SDK 0.18.2 and Playwright 1.63.0; no dependency install.
**Spec:** docs/superpowers/specs/2026-10-22-other-world-random-design.md

## Global constraints
Current directory and branch; preserve all unrelated tracked/untracked changes. No commits/push/merge/deploy. Self-approved stages under explicit user delegation. Log execution below.

## Review focus
Partial dice exhaustion; failure after consumed ID/token; rejected-result rollback; successful consumption; contexts without checkpoint. Tests in Task 1 pin each behavior. Real server tests remain the authority/privacy regression boundary.

## Task 1: Engine transaction RED to GREEN
Files: create packages/engine/src/other-world-random.ts and packages/engine/test/other-world-random.test.ts; modify packages/engine/src/index.ts.
Interfaces: internal withOtherWorldRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult; existing resolveOtherWorldEncounter and executeCommand signatures unchanged.
- [x] Write tests with two-card valid inventory/Gate fixture and typed nested test tree. Direct/command partial dice exhaustion returns RANDOM_INPUT_REQUIRED, preserves state and first input. Resumed JSON-restored test reroll fails after die consumption and preserves paid Clue, decision, ID and retained dice. Successful result advances input. Helper rejected/throw paths restore all four context sequences; no-checkpoint contexts still run successfully and convert exceptions.
- [x] Run pnpm --filter @eldritch/engine exec vitest run test/other-world-random.test.ts; observe failures caused by missing transaction behavior.
- [x] Implement helper; wrap direct resolver through a private implementation; wrap only Other World RESOLVE_DECISION at executeCommand before default dispatch.
- [x] Rerun focused test, other-world-state.test.ts and other-world-encounter.test.ts; run complete engine suite/typecheck.

## Task 2: Review and verification
- [x] Update docs/architecture/other-world-integrity.md with implemented atomicity and remaining discard dependency.
- [x] One independent read-only clean-context reviewer examines task diff/spec/tests. Reproduce material findings RED, fix GREEN, repeat relevant checks.
- [x] Run pnpm lint, pnpm typecheck, pnpm test (includes multiplayer), pnpm build, pnpm test:e2e and both dedicated Playwright configs. Record actual results and limitations.
- [x] Review git diff --check and scoped diff; rename chat; report. Start next discovery iteration as requested.

## Self-review and execution ledger
Spec coverage and exact names checked; Task 1 owns all changed behavior; Task 2 verifies unchanged server/client boundaries. No unresolved ambiguity. Plan self-approved.
Ruling: implement RNG atomicity before physical discard, since current live callbacks can consume partial randomness on failure. Cost: physical discard remains a separate iteration.
- Task 1 RED: three integration failures (direct/command partial dice exhaustion and paid reroll ID exhaustion). Root cause: neither boundary used existing checkpoint capability; stack traces reached rollDie/createId after partial consumption.
- Task 1 GREEN: focused 525/525 before helper coverage, full engine 1338/1338 after adding rollback of all four sequence kinds and no-checkpoint coverage. No dependency install. Default pnpm list hits restricted external SQLite store; bundled pnpm with pnpm_config_verify_deps_before_run=false runs tests against unchanged installed packages.
- Independent clean-context reviewer: no actionable findings; independently ran 528/528 focused tests. Final lint/typecheck/build exit0; root test exit0, engine1338/content127/protocol21/server288. Server tests required expanded local network permissions after sandbox fetch failures.
- Browser verification: default7/7 and Norman2/2. Initial overlapping configurations conflicted in test-results; fixed by running them sequentially, no product changes. Spell configuration pending at this entry.

- Final Spell browser2/2 exit0. All required checks passed; git diff --check clean except pre-existing line-ending notices. No deferred findings. Current branch and all pre-existing changes preserved; no Git writes. Next iteration begins with existing physical Other World discard spec.
