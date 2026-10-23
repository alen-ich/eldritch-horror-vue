# Bound Research refusal implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline.

**Goal:** Execute Cthulhu1 Sea acceptance and refusal faithfully with original Clue provenance.

**Architecture:** Clean `encounter-instructions.ts`, `research-instructions.ts`, `research-marker-binding.ts` gain a bound discard node and recursive decline binding. Dirty `index.ts` adds only adapter to existing `resolveBoardClueEffect`. Existing optional command lifecycle/Monster stats/Spell lifecycle unchanged. TS5.9.3/Vitest3.2.7, no packages.

## Task1 — engine RED→GREEN
- [x] New `packages/engine/test/research-refusal.test.ts`: actual card accept/refuse/cannot-pay; discard-before-Will, parent/Monster conservation, JSON owner rerolls, lethal interruption, RNG rollback, malformed declines and provenance tampering. Observe RED with package-filtered Vitest.
- [x] Implement exact effect parser/label, authored discard binding and decline recursion, marker traversal, interpreter adapter. Run relevant Research/Spell/marker suites.
- [x] Update clean existing generic Cthulhu binding count22/24 and exclude1 Sea from old fixture; update old Mists test to assert full decline is retained instead of former unsupported status.

## Task2 — multiplayer
- [x] New `apps/server/test/ResearchRefusal.test.ts` real-room accept/refuse checkpoints, JSON restoration after discard, guest rejection, projection/pools. Register own two lines in dirty `GameRoom.test.ts`.
- [x] Focused loopback Mocha, then full multiplayer through root test.

## Task3 — finish
- [x] One independent clean-context reviewer; reproduce material findings through RED→GREEN.
- [x] Sequential pnpm lint/typecheck/test/build; Playwright default/Norman/Spell with loopback access. Record actual results.
- [x] Save exact already-applied own `index.ts`/server test registration patches against captured UTF-8 foundations, verify reverse --check. New status `docs/architecture/research-refusal.md`, update clean prior status. Scoped commit clean/new files and patches only; preserve unrelated dirty foundation/secrets. Rename chat/update existing hourly continuation.

## Approval and ledger
Self-reviewed and approved under explicit delegated user authority. Current branch/directory, no worktree. Baselines/logs local untracked `.superpowers/research-refusal/`. No product changes before design/plan approval. Patches are already applied and must never be applied twice.

- Engine RED9/10: actual card could not bind, so accept/refuse/cannot-pay/restoration/rollback/provenance scenarios failed before their intended mechanics. After implementation GREEN9/10; remaining failure was a fixture lacking any route from Sea to a nearest City for defeat. Added the real map relationship to the fixture, no product change; extended Strength restore/physical substitution cases. Final focused5 suites99/99, including new12/12.
- Real-room2/2: both optional outcomes, private initial offer, guest rejection, JSON-restored Will and Strength after bound marker removal, once-only physical discard, rewards and untouched Monster pools. Existing Colyseus0.18.14 APIs reused; no package/server implementation change.
- Independent fresh-context reviewer `/root/review_research_refusal`: no actionable findings; viewed card1 scan,32/32 focused tests, both own patch reverse checks passed. No edits or review repairs.
- No implementation deviations. Generic Cthulhu fixture keeps its old18 generic branch assumptions while the dedicated suites own Cultist/Mists/refusal; count updated22. Old Mists test now asserts the full bound decline rather than treating completed mechanics as unsupported.
- Own dirty `index.ts` delta is only the existing physical-discard adapter; dirty room-test registration is only two own lines. Saved UTF-8 already-applied patches against pre-iteration snapshots; reverse --check passed. Earlier dirty/untracked prerequisites and secrets remain outside the commit. Final checks refer to that dirty workspace, not a clean checkout of those prerequisites.
- Final sequential verification: lint5/5, typecheck5/5, test8/8 (engine1692/content166/protocol21/server310), build5/5; Playwright default7/7, Norman2/2, Spell2/2. No final command failures. Existing Turbo test-output warnings and browser NO_COLOR/FORCE_COLOR/offline-test logs remain nonfatal. Logs are local in `.superpowers/research-refusal/`.
- Next orientation: only Cthulhu3 Sea Grotesque Statue and8 Sea Ruby of R'lyeh remain unsupported. Inspect actual Artifact scans, on-gain behavior, action/prevention hooks and all `supportedArtifact` callers before choosing the next prerequisite; merely whitelisting the IDs would bypass printed effects. No automatic RNG hardening or expansion of awakening/possession guards.
