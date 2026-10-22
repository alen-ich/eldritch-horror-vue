# Encounter setup ownership implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline with test-driven-development.

**Goal:** Keep Research/Expedition setup order independent from injected provider storage.
**Architecture:** Copies at the existing pure initializer return boundaries; unchanged command/validation contracts.
**Tech stack:** Installed TypeScript 5.9.3/Vitest 3.2.7, pinned pnpm 10.28.0; no dependencies added.
**Spec:** ../specs/2026-10-22-encounter-setup-ownership-design.md

## Global constraints

Server owns private decks; public interface and rules unchanged. Current branch/directory. Preserve untracked source foundation: commit an exact already-applied two-file source patch, never the original full source. No push/merge/worktree.

## Review focus

Non-grant START_GAME alias; all four Research deck choices; Expedition marker consistency; starting-Spell downstream-clone controls; frozen/in-place providers. Task 1 covers all five.

## Task 1: Isolate returned physical setup order

**Files:** Modify pre-existing untracked `packages/engine/src/research-setup.ts` and `packages/engine/src/expeditions.ts`; create `packages/engine/test/encounter-setup-ownership.test.ts`, `docs/architecture/encounter-setup-ownership.md`, `docs/superpowers/patches/2026-10-22-encounter-setup-ownership.patch`.
**Interfaces:** Preserve `initializeResearchDeck(cards: readonly ResearchSetupCard[], deck: ResearchEncounterDeckId, shuffle: EngineContext["shuffle"]): string[]` and `initializeExpeditionDeck(cards: readonly ExpeditionSetupCard[], shuffle: EngineContext["shuffle"]): { deck: string[]; locationId: ExpeditionLocationId }`. Real command consumer: executeCommand/START_GAME.

- [x] RED: New fixture uses startingContent/lobby, switches host to Trish for no grant, supplies canonical 32 Research cards or 18 Expedition cards/six sites. For all four Ancient Ones use matching Mystery fixture catalog. Retain reversed provider order. Assert returned order/top site, mutate provider and engine storage in both directions, verify original state/content unchanged and projections omit private IDs. Repeat with Norman starting Spell grant as a control.
- [x] RED: Exercise frozen output and provider in-place reversal through START_GAME; catalog remains unchanged and returned storage is mutable/independent.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/encounter-setup-ownership.test.ts`; expect non-grant identity/mutation isolation failures, inspect cloning controls honestly.
- [x] GREEN: Return copied validated order/deck in the two initializers; retain all existing validation/marker derivation. Run new suite plus research-setup, expedition-setup, expedition-discard and research-discard suites.
- [x] Save exact delta against `.superpowers/encounter-setup-ownership/*.before.ts` as a git-compatible patch with correct repository paths. Check patch matches applied changes without including foundation. Update architecture status.
- [x] Run pnpm lint, typecheck, test, build and three Playwright configs sequentially. Request one independent clean-context read-only reviewer. Reproduce/fix material findings via TDD, update journal and scoped commit only new test/docs/patch files.

Self-review: signatures match source; criteria map to tests; one verifiable task. Self-approved.

## Execution journal

Preflight 2026-10-22: baseline 7fd15c9; source files still untracked, unrelated dirty tree unchanged. Spec 884d855. Exact source baselines saved under this iteration's scratch folder. Previous plans complete; no task resumed. Use pinned .superpowers/pnpm.cmd with its directory in PATH and allowed loopback for integration/browser checks.

2026-10-23 local: initial overbroad frozen/in-place provider affected unrelated Mystery/Asset setup, producing two unrelated failure classes. Ruling: restrict provider mutation/freezing to the selected encounter family — this iteration's contract is its initializer, not all RNG sites — cost if wrong: unrelated setup providers remain unsupported; recorded as next audit candidate. Corrected RED 7 failures/7 passes: five no-grant alias failures and two frozen engine-storage failures; five Spell-grant controls and two valid in-place controls already pass.

GREEN 14/14 new tests and 76/76 combined setup/discard cases. Minimal source delta is two copied-array return expressions. Patch preserves prior untracked foundation; no original full source staged. Source snapshots kept only in iteration scratch for reviewer comparison.

### Verification repair task — Reserve browser harness

Files: already-dirty tests/e2e/multiplayer.spec.ts; exact new delta saved separately in this iteration's patch. Interface: existing Playwright roles Collapse reserve/Expand reserve/Buy nothing, no product API.
- [x] RED: in Personal Assistant journey, after free reroll becomes visible, explicitly collapse Reserve if expanded. Run targeted `pnpm exec playwright test tests/e2e/multiplayer.spec.ts --grep 'Personal Assistant' --workers=1`; expect missing Buy nothing. Preserve original failure trace/DOM in scratch.
- [x] GREEN: explicitly click Expand reserve before final Buy nothing expectation. Rerun target, main and dedicated browser suites; expect pass. No production change.

Ruling: include this test-only repair because trace proves the required validation was inspecting an intentionally hidden shelf after its own fallback — cost if wrong: extra UI steps in a shared E2E scenario; deterministic RED/GREEN verifies the cause. Engine root checks need no repeat solely for the browser test edit; final browser suites must rerun. Independent reviewer approved the two-line engine delta and exact patch, 76/76; this later verification-harness repair is author-verified separately.

Verification-repair RED: targeted Personal Assistant fails at Buy nothing after forced collapse; GREEN 1/1 after Expand reserve. Saved original browser file baseline; own four added lines preserved in docs/superpowers/patches/2026-10-23-personal-assistant-reserve-visibility.patch, already applied. No new app behavior or unrelated test edits.

Task 1 and verification-repair task complete, 2026-10-23. Independent clean-context engine reviewer found no Critical/Important/Minor findings, independently passed 76/76 and verified the two exact source replacements plus reverse patch check. Browser harness repair is separately author-verified RED/GREEN; no second reviewer dispatched.
Final: Ruling: unrelated dirty code, other RNG ownership sites, arbitrary provider side effects and broader recycle/rules guarantees remain outside this change — cost if wrong: independent pre-existing defects remain; next iteration must verify a real command path before expanding scope.
Final verification (sequential): pnpm lint/typecheck/build each 5/5 tasks exit 0; pnpm test 8/8 tasks, 1629 engine, 127 content, 21 protocol, 304 server. Initial main browser run: 6 passed, Personal Assistant failed because test left Reserve collapsed. Targeted deterministic RED reproduced missing Buy nothing; targeted GREEN 1/1 passed after reopening. Final Playwright default 7/7, Norman 2/2, Spell 2/2, each exit 0. git diff --check and reverse --check on both saved patches exit 0. Existing Turbo outputs/npm environment/Playwright color warnings only.
Preservation: source patch contains 1 replacement in each of two pre-existing untracked source files; browser patch contains only 4 added lines relative to the pre-existing dirty browser test. Original full source/browser files stay outside index. New test and docs plus amended spec are scoped commit contents. Verification is for this dirty workspace, not a standalone clean checkout. No dependency, public API or readiness changes; current master branch retained as requested, no push/merge.
Next investigation already oriented: START_GAME passes mysteryIds directly to shuffle then shifts it, and retains Mystery/Asset provider output. The initially broad provider test exposed content mutation; treat it as a candidate, reproduce actual consequences before designing the next iteration.

Artifact follow-up: cached diff check flagged two whitespace-only context lines in the saved source patch; the shell continued to commit despite that nonzero check. Trimmed each hunk to one nonblank context line on either side; normal reverse-check still verifies the exact applied replacements. No source/test behavior changed. Recheck scoped committed diff before final report.
