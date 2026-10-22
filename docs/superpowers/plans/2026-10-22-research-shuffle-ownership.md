# Research shuffle ownership implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Steps use checkboxes.

**Goal:** Prevent retained RNG arrays from mutating canonical Research deck state.
**Architecture:** Copy validated shuffle output at the existing private helper boundary.
**Tech Stack:** Pure TypeScript, installed Vitest 3.2.x; no added packages.
**Spec:** ../specs/2026-10-22-research-shuffle-ownership-design.md

## Global constraints

Server owns canonical state; undrawn order remains private. Preserve unrelated working-tree changes. Use current branch/directory as explicitly requested. No framework API changes.

## Review focus

Last-card recycle and singleton completion; both mutation directions; preserved order; unchanged caller input; malformed-provider rejection. New regressions exercise the first four; existing research-discard tests exercise the fifth.

## Task 1: Own recycled arrays

**Files:** Create `packages/engine/test/research-shuffle-ownership.test.ts`; modify `packages/engine/src/research-state.ts`; create `docs/architecture/research-shuffle-ownership.md`.
**Interfaces:** Existing `resolveResearchEncounter(state, playerId, markerId, content, context): CommandResult`, `executeCommand(...): CommandResult`, `EngineContext.shuffle<T>(items: readonly T[]): T[]`. No export/signature changes. Private `shuffleCards(ids: readonly string[], context: EngineContext): string[]` returns engine-owned storage.

- [x] RED: Build a minimal two-card Research fixture with first card testing Will and second previously discarded. Retain shuffle output; after real resolution assert private deck equals `[second]`, is distinct from output, remains unchanged when output is mutated, and does not mutate output when changed itself. Original state stays equal to its snapshot.
- [x] RED: Repeat through real decision completion for singleton `[first]`, asserting the same independent storage contract and input immutability.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/research-shuffle-ownership.test.ts`; expect two failed identity assertions.
- [x] GREEN: Return a copy after existing validation in `research-state.ts`.
- [x] Run new suite plus `test/research-discard.test.ts`; expect all pass. Record RED/GREEN in execution journal.
- [x] Update status documentation, inspect exact diff, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec playwright test --workers=1`, and dedicated Norman/Spell configs.
- [x] Request one clean-context independent reviewer for this iteration, fix material findings via RED/GREEN, record outcomes. Commit only this task's files and journal.

Self-review: spec coverage complete, signatures match existing code, task independently verifiable, no placeholders. Self-approved under explicit user authorization.

## Execution journal

Preflight: source clean at entry; extensive unrelated dirty files excluded. Current branch master explicitly authorized. Root pnpm shim stalls; investigate installed offline runner before checks. Spec committed separately.

Task 1: RED 1 failed/1 passed. Draw retained the exact provider array; singleton completion already cloned downstream. Ruling: retain completion case as compatibility control rather than force an artificial failure — actual public path already satisfies the contract — cost if wrong: incomplete lower-level regression, mitigated by shared helper fix. GREEN 14/14 including existing physical discard suite. Minimal fix copies the validated result. Bundled pnpm 11 initially attempted automatic dependency verification/repair and hit a protected SQLite store; no manifest/lockfile delta. With verification disabled it ran targeted tests. Found existing `.superpowers/pnpm.cmd` pointing to cached pinned 10.28.0; use that for final checks.

Final review: independent clean-context reviewer approved, no findings; independently ran 14/14. Ruling: other shuffle boundaries stay separate iterations; unrelated diffs and broad rules/network behavior are outside this narrow change, whose unchanged contracts are covered by root/browser checks — cost if wrong: an existing independent defect remains; next iteration inspects setup boundaries.
Final verification: pinned pnpm 10.28.0; lint/typecheck/build 5/5 tasks each exit 0. Test 8/8 tasks, engine 1527, content 127, protocol 21, server 304. Initial sandbox test had 200 loopback fetch failures; rerun with local-network access passed. Playwright default 7/7, Norman 2/2, Spell 2/2, all exit 0. git diff --check exit 0. Tooling warnings: Turbo test outputs configuration, npm environment config and Playwright color variables; no check failed on rerun. Verification is for the existing dirty workspace, not a standalone clean checkout of its uncommitted prerequisites.
Task 1: complete; source, tests, architecture status and execution journal ready for scoped commit. No added dependency, public interface or rules readiness change. Keep current branch as explicitly requested; no merge/push.
