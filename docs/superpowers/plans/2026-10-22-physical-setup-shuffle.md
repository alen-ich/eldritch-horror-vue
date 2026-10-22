# Physical setup shuffle implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, task by task.

**Goal:** Conserve Gate/Artifact physical identity and isolate injected shuffle storage.
**Architecture:** One private checked helper used by the two existing setup builders.
**Tech Stack:** Installed TypeScript 5.9.3/Vitest 3.2.7, pinned pnpm 10.28.0. No new packages/framework APIs.
**Spec:** ../specs/2026-10-22-physical-setup-shuffle-design.md

## Global constraints

Engine stays pure; private deck order never synchronizes. Preserve unrelated dirty changes. Current branch/directory and self-approval explicitly authorized. No effect/readiness expansion.

## Review focus

Sparse catalogs and results; mutable provider input; retained provider output; invalid output passing validation; compatible order/error mapping. All are pinned by Task 1's matrix and command test.

## Task 1: Validate and own Gate/Artifact setup permutations

**Files:** Modify clean `packages/engine/src/setup.ts`; create `packages/engine/test/physical-setup-shuffle.test.ts` and `docs/architecture/physical-setup-shuffle.md`.
**Interfaces:** Preserve `buildArtifactDeck(ids: readonly string[], shuffle: <T>(items: readonly T[]) => T[]): string[]` and equivalent `buildGateStack`. New private `shufflePhysicalIds` with same arguments/return type. Existing executeCommand/START_GAME is the integration consumer.

- [x] RED: For both builders use literal two-ID catalogs. Reject sparse input, explicit undefined/null/non-string/empty-string input, duplicate/empty catalogs; reject sparse/nonarray/extra/missing/duplicate/foreign provider output. A provider mutating its argument to a foreign ID cannot bypass validation and cannot change original input.
- [x] RED: Accept a valid reverse in-place permutation without changing source; assert returned engine storage differs from retained provider output and mutation is isolated both ways. Frozen valid input/output remain usable.
- [x] RED: Through startingContent/lobby fixtures, add two Artifact IDs and inject duplicate Artifact output into START_GAME. Expect RANDOM_INPUT_REQUIRED and unchanged lobby. Verify retained deterministic input is rolled back by consuming one die in the failing provider and observing the same die after rejection.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/physical-setup-shuffle.test.ts` and inspect expected validation/alias failures.
- [x] GREEN: Dense string checks retain Artifact regex and Gate nonempty semantics. Snapshot expected identity set before passing a copy to provider; validate exact array permutation; return a copy. Existing errors for catalog validation retain their patterns.
- [x] Run focused new, setup, artifact-supply and starting-spell suites; then pnpm lint/typecheck/test/build plus default, Norman and Spell Playwright configs. Record actual results.
- [x] Read-only independent clean-context review; reproduce material findings RED, fix GREEN. Update architecture status and journal, inspect diff, commit only this iteration.

Self-review complete: acceptance maps to tests, exact signatures match, scope remains one independently verifiable task. Self-approved.

## Execution journal

Preflight: setup.ts clean; source baseline b023e51 plus spec commit 3dafd6d. Existing dirty files excluded. No worktree. Use existing .superpowers/pnpm.cmd pinned 10.28.0; allow loopback for multiplayer/browser checks.

Task 1 RED: initial 21 failures; corrected Vitest table rows to pass arrays as object properties, then tested final regression against original setup.ts (saved/restored own green source in try/finally): 24 failed, 11 passed. Expected actual duplicate Artifact command acceptance and invalid permutation/alias acceptance reproduced. GREEN uses a private physical-ID helper; no unrelated source change.

Ruling: integration fixture preserves existing SPELL_RANDOM_INPUT_INVALID mapping from withStartingSpellRandomTransaction rather than the plan's guessed RANDOM_INPUT_REQUIRED — matches spec's unchanged exception mapping — cost if wrong: fixture does not exercise production Location wrapper; full multiplayer tests cover existing production setup. Plan's starting-spell.test.ts path corrected to actual starting-spells.test.ts plus starting-spell-transactions.test.ts.

Task 1: complete. GREEN 70/70 across new boundary, setup, Artifact supply and starting Spell suites. Independent clean-context reviewer approved with no findings and independently ran 70/70.
Final: Ruling: keep other shuffle/recycling sites and unrelated dirty changes outside this diff; proxies/custom iterators are outside the injected plain-array provider contract, and no change is needed for them — cost if wrong: an independently adversarial in-process provider remains unsupported. Broad readiness is not claimed; root/browser checks are author-run.
Final verification: pnpm lint/typecheck/build each 5/5 tasks exit 0; pnpm test 8/8 tasks, 1562 engine, 127 content, 21 protocol, 304 server. Playwright default 7/7, Norman 2/2, Spell 2/2 exit 0. git diff --check exit 0. Existing Turbo outputs/npm environment/color warnings only. All results refer to this pre-existing dirty workspace; unrelated prerequisites remain uncommitted. Preserve current branch, no push/merge requested.
