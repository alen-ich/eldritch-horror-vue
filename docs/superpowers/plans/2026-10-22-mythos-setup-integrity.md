# Mythos setup integrity implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline.

**Goal:** Preserve physical IDs and stage composition across Mythos setup random input.
**Architecture:** Dense preflight and existing private shufflePhysicalIds for color/stage permutations.
**Tech Stack:** Pure TypeScript 5.9.3/Vitest 3.2.7; pnpm 10.28.0; no package changes.
**Spec:** ../specs/2026-10-22-mythos-setup-integrity-design.md

## Global constraints

Server-authoritative private order; no effect/protocol/readiness changes. Current branch/directory. Preserve unrelated modifications. Same exception mapping as before.

## Review focus

Late-stage corrupt output; empty stages/colors; sparse records; provider-reused mutable buffers; whole START_GAME rollback. Each is exercised in Task 1.

## Task 1: Conserve staged Mythos setup

**Files:** Modify `packages/engine/src/setup.ts`; create `packages/engine/test/mythos-setup-integrity.test.ts`, `docs/architecture/mythos-setup-integrity.md`.
**Interfaces:** Existing `buildMythosDeck(cards: readonly {id:string;color:MythosColor}[], stages: AncientSetup["mythosDeck"], shuffle: <T>(items: readonly T[]) => T[]): string[]`; private shufflePhysicalIds from preceding iteration. Existing startingContent/lobby fixtures and START_GAME.

- [x] RED: Nine literal IDs (three per color), three `{green:1,yellow:1,blue:1}` stages. For shuffle calls 1–6 inject missing/extra/duplicate/foreign/sparse/nonarray/mutated-input output; expect refusal and unchanged source. Verify malformed dense/sparse catalog/stages reject before RNG.
- [x] RED: A provider reusing one array across calls still yields literal `g1,y1,b1,g2,y2,b2,g3,y3,b3`. Mutating retained output after return cannot alter result; source unchanged. Control: all-zero stages/empty catalog, zero-size color pools, valid reverse in-place permutations preserve expected selected stage order and leave unselected IDs out.
- [x] RED: START_GAME using starting Spell transaction plus minimal AncientSetup/Mythos catalog. Invalid first color shuffle consumes one deterministic die, rejects with SPELL_RANDOM_INPUT_INVALID, preserves lobby and restores that die.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/mythos-setup-integrity.test.ts`; inspect expected corruption acceptance/alias/preflight failures.
- [x] GREEN: Require dense legal catalog and three stage objects before existing counts check. Replace both unvalidated shuffle call sites with shufflePhysicalIds; preserve six calls including empty pools/stages.
- [x] Run focused Mythos/new/setup/Gate/Artifact suites, then root lint/typecheck/test/build and default/Norman/Spell Playwright. Record outcomes.
- [x] Independent clean-context read-only review; reproduce/fix material findings via TDD; update status/journal and scoped commit.

Self-review: spec coverage, signatures, stage counts and tests consistent. Self-approved under explicit user authorization.

## Execution journal

Preflight baseline 70b3c47 plus spec c25294a; setup.ts clean. No worktree; existing .superpowers/pnpm.cmd pinned 10.28.0. Prior dirty changes preserved; all checks refer to working directory.

Task 1: RED 45 failures/8 passes (53 cases), corruption and reused-provider-buffer defects reproduced through real builder/command paths. GREEN 123/123 across six focused suites, including 53 new cases. Reused existing helper rather than introducing another abstraction. No source-scope deviation or rule change.

Final review: independent clean-context reviewer approved, no findings; independently passed 53/53 new and 97/97 combined setup tests. No implementation deviations.
Final: Ruling: other setup/recycling boundaries, unrelated dirty files, live rules and general transaction guarantees beyond the tested wrapper stay separate; adversarial getters/proxies and providers mutating unrelated captured objects are outside this plain-array provider contract — cost if wrong: an independent existing in-process misuse or untested wrapper issue remains. No full readiness claim.
Final checks: pnpm lint/typecheck/build each 5/5 tasks exit 0. pnpm test 8/8 tasks: 1615 engine, 127 content, 21 protocol, 304 server. Playwright default 7/7, Norman 2/2, Spell 2/2 exit 0. git diff --check exit 0. Existing Turbo/npm environment/color warnings only. Prior user work preserved, no manifest/lockfile changes. Tests cover the existing dirty workspace, not all its prerequisites in a clean checkout. Task 1 complete; keep branch and save scoped commit.
