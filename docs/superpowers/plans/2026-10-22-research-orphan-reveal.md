# Research orphan reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline as requested.

**Goal:** Reject inconsistent current Research reveals before restored state or commands can execute.
**Architecture:** Extend existing pure continuation validator used by engine and server.
**Tech Stack:** TypeScript, Vitest, Mocha/Colyseus 0.18.5, existing Playwright.
**Spec:** docs/superpowers/specs/2026-10-22-research-orphan-reveal-design.md

## Global constraints
No wire changes/dependencies. Current branch and directory, preserve unrelated edits. Generic errors cannot contain card IDs. No silent snapshot repair.

## Task 1: Engine and room restoration invariant
Modify packages/engine/src/research-continuation-integrity.ts and packages/engine/test/research-continuation-integrity.test.ts. Create apps/server/test/ResearchOrphanReveal.test.ts and docs/architecture/research-orphan-reveal.md.
Interface unchanged: validateResearchContinuationState(state: GameState, content: GameContent): string | undefined. Consumed by executeCommand and GameRoom.applyEngineState before any mutation.
- [ ] Add table tests for absent pending and generic pending with Research current reveal: validator error; END_TURN returns ENCOUNTER_CONTENT_MISSING; source unchanged; deterministic die remains 6; generic result contains no card ID. Add accepted no-current/no-pending, completed-last-Research, genuine unrelated pair.
- [ ] Add standalone real server Mocha suite with boot/cleanup/shutdown. Host and guest connect. For both corruptions, applyEngineState throws and serialized public state/private engine snapshot stay unchanged.
- [ ] RED run `node packages/engine/node_modules/vitest/vitest.mjs run packages/engine/test/research-continuation-integrity.test.ts`; and `pnpm --filter server exec mocha -r tsx test/ResearchOrphanReveal.test.ts --exit --timeout 15000`. Expect orphan cases accepted before fix.
- [ ] GREEN extend early return only: reject encounter_research_ current reveal when pending is not Research; preserve unrelated paths. Repeat focused runs, expect exit0.

## Task 2: Final review and verification
- [ ] One fresh independent read-only reviewer; fix material findings via RED/GREEN.
- [ ] Run pnpm lint/typecheck/test/build, default E2E and sequential Norman/Spell configs. Use bundled pnpm with verify-deps-before-run=false; networking tests need unrestricted localhost access proven in previous iteration.
- [ ] Update status and ledger, git diff --check, commit only this iteration's tracked source delta and test/docs additions.

## Review focus
Absent pending, unrelated pending, completed last card, no reveal, legacy partial Research continuation. Task1 asserts each; additionally inspect defeat/combat pauses for valid current Research reveals lacking pending before declaring rejection safe.

## Self-review and ledger
Spec and plan self-approved under explicit user delegation. No shared-interface change. Preflight: Research completion clears both fields; no state mutation should precede validation. Current branch master, starting HEAD d2123d7.

- Task1 RED: engine2/15 failed because orphan states returned undefined; standalone server2/2 failed with missing expected exception. GREEN engine15/15, server2/2.
- Full verification exposed two test-harness problems: generic was not a real EncounterDeckId (correct ID general); booting a second server against reused appConfig caused ERR_HTTP_HEADERS_SENT after the main suite shutdown. Neither changes product behavior.
- Ruling: register the new room tests through the existing tracked ResearchDrawIntegrity.test.ts registration, reusing the suite's single server rather than standalone boot. Cost if wrong: registration could omit tests, so verify full server count increases from296 to298. Focused command becomes `pnpm --filter server exec mocha -r tsx test/GameRoom.test.ts --grep 'Research orphan reveal' --exit --timeout 15000`.
- Independent fresh-context read-only review found no actionable issues; focused engine15/15. Reviewer checked normal completion, damage/defeat and ambush retention; no valid orphan-reveal path found. No declined product behavior. Full checks and unrelated dirty work were outside reviewer scope and remain implementer verification duties.
- Final checks after harness correction: pnpm lint exit0 (5/5), typecheck exit0 (5/5), build exit0 (5/5), test exit0 (8/8): engine1415/content127/protocol21/server298. Server count includes the two new cases. Default Playwright7/7, Norman2/2, Spell2/2, all exit0. No production correction was needed after review. git diff --check exit0 (existing CRLF warnings only).
- Finishing decision: retain current branch/master and all pre-existing working-tree changes, scoped local commit only. No push/merge/deploy. Automatic approval review rejected an attempted hourly continuation schedule because persistent scheduled modifications lacked explicit authorization; no automation was created and no workaround attempted.
