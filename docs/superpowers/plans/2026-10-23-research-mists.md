# Named Research Spell implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Activate only Cthulhu6 City Mists of Releh reward through existing Spell lifecycle.

**Architecture:** Extend clean `encounter-instructions.ts` named whitelist/label. Dirty `index.ts` imports gainSpell, validates Spell nodes in existing dynamic preflight and applies the existing kind transfer; preserve exact foundation as already-applied own patch. Server mapping already supplies spells, so no server implementation change. TypeScript5.9.3/Vitest3.2.7, existing pnpm10.28.0.

## Task1 — RED→GREEN engine
- [x] Add `packages/engine/test/research-mists.test.ts`: real authored card success/failure, supply conservation/unavailable/duplicate behavior, malformed node/content/inventory, JSON owner reroll/privacy, RNG rollback and existing held-Mists guard. Observe meaningful RED via `pnpm --filter @eldritch/engine exec vitest run test/research-mists.test.ts`.
- [x] Implement exact ID parser/label, dynamic preflight and effect application using `gainSpell` kind request. Run focused Research/Spell suites.
- [x] Update clean `cthulhu-research.test.ts` binding21/24 and exclude this section from old generic assumptions; dedicated test owns new branch mechanics. Preserve card1 Sea refusal rejection.

## Task2 — real multiplayer
- [x] New `apps/server/test/ResearchMists.test.ts` registers real-room checkpoint/restoration/ownership/private inventory cases. Register only own two lines in dirty `GameRoom.test.ts` and save own patch. Existing room/content boundary unchanged. Run focused Mocha grep with loopback access.

## Task3 — finish
- [x] Fresh-context independent reviewer; reproduce material findings with RED tests, fix, reverify.
- [x] Sequential pnpm lint/typecheck/test/build and Playwright default/Norman/Spell; record actual counts and failures. All test commands use package cwd/Turbo, never full Vitest at root.
- [x] Save exact already-applied dirty-source/test patches using explicit UTF-8 and verify reverse --check. Update new architecture status and old clean status link. Scoped commit clean/new files and own patches only; preserve dirty foundations/secrets. Rename chat and update existing heartbeat continuation.

## Approval and execution ledger
Self-reviewed and approved by the implementing agent under explicit delegated user approval. Work in current directory/branch, no worktree. Baselines in local untracked `.superpowers/research-mists/`; no product implementation before approval. Patches must not be reapplied.

- RED6/10: actual authored success/failure/restoration/rollback and named parser rejected. GREEN10/10 new; related Research/Cultist/Spell lifecycle76/76. Initial unavailable-supply fixture incorrectly put both same-name copies on one guest, which existing inventory validation correctly rejected; distributed copies across two other seats and retained the guard. No product change for that fixture error.
- Real-room2/2: Observation restored through JSON, guest denied owner choice, pass grants one Mists and exact Clue, failure grants Paranoia, private physical identity absent from all synchronized views. Existing Colyseus0.18.14 APIs reused; no runtime mapping changes or packages.
- Independent fresh-context reviewer `/root/review_research_mists`: no actionable findings; visually confirmed source crop,61/61 focused tests, both patches reverse --check. No edits or review repairs required.
- No implementation deviations. Existing held-Mists guard rejects entry before any reward; this does not promise that a duplicate-holder can execute the encounter. Cthulhu1 Sea still rejects its unimplemented refusal/discard semantics, and named Artifact gain/effects remain closed.
- Exact own patches captured with UTF-8 against pre-iteration baselines and checked in reverse; entire dirty `index.ts`/`GameRoom.test.ts` foundations excluded. Clean `encounter-instructions.ts` and existing generic test expectation changed directly; new tests/docs belong to this iteration. Verification concerns the dirty workspace, not a clean checkout of unstaged prerequisites.
- Final sequential checks: lint5/5, typecheck5/5, test8/8 (engine1680/content166/protocol21/server308), build5/5; Playwright default7/7, Norman2/2, Spell2/2. No final command failures. Existing Turbo test-output warnings, browser NO_COLOR/FORCE_COLOR and intentional offline-test logs remain nonfatal. Local logs: `.superpowers/research-mists/`.
- Next orientation: Cthulhu1 Sea remains blocked by `bindResearchInstruction` rejecting optional decline and encountered-Clue discard. Inspect source and existing physical board-Clue discard/marker provenance before enabling that branch; do not drop the refusal consequence or repeat Mists reward work. Grotesque Statue/Ruby rewards require their own unsupported gain/effect prerequisites.
