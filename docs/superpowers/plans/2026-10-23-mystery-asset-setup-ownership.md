# Mystery/Asset setup ownership implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline with test-driven-development and systematic-debugging.

**Goal:** Keep START_GAME from consuming shared Mystery catalogs or provider-owned Mystery/Asset arrays.
**Architecture:** Input/output copies at existing command setup sites; no new public API or helper.
**Tech stack:** Installed TypeScript 5.9.3/Vitest 3.2.7, pnpm 10.28.0. No added packages.
**Spec:** ../specs/2026-10-23-mystery-asset-setup-ownership-design.md

## Global constraints

Pure engine, authoritative server, private remaining order. Current branch/directory; no worktree/push/merge. index.ts is already dirty: save only exact own delta as an already-applied patch, never stage its full contents. Preserve existing exception/validation behavior and readiness.

## Review focus

Shared content across two starts; downstream-clone paths; provider consumption during setup; frozen/in-place results; public remaining-ID filtering. Task 1 exercises all five.

## Task 1: Own Mystery/Asset arrays at setup

**Files:** Modify pre-existing dirty `packages/engine/src/index.ts`; create `packages/engine/test/mystery-asset-setup-ownership.test.ts`, `docs/architecture/mystery-asset-setup-ownership.md`, `docs/superpowers/patches/2026-10-23-mystery-asset-setup-ownership.patch`.
**Interfaces:** Existing executeCommand(state: GameState, actorPlayerId: string, command: GameCommand, content: GameContent, context?: EngineContext): CommandResult. Existing EngineContext.shuffle<T>(items: readonly T[]): T[]. No signature/export changes.

- [x] RED: Reuse startingContent/lobby, six literal Assets a–f. For grant false/true, targeted Mystery shuffle returns its input; start two independent lobbies using one content object. Both must succeed, content unchanged, game arrays independent. Original currently mutates content and second start fails MYSTERY_CONTENT_MISSING.
- [x] RED: For both families/grant modes, retain reversed provider output. Require provider arrays remain full/unconsumed, literal active/remaining/Reserve order, bidirectional mutation isolation, source immutability, one version increment, no private remaining IDs in public/owner projections.
- [x] RED: For both families test frozen and in-place provider results through START_GAME; preserve source and usable mutable engine order. Restrict provider behavior to the selected family to avoid asserting unrelated setup contracts.
- [x] Run `pnpm --filter @eldritch/engine exec vitest run test/mystery-asset-setup-ownership.test.ts`; inspect ownership/content/frozen-storage failures.
- [x] GREEN: In index.ts copy Mystery catalog before shuffle and both results before shift/splice; Asset input is already fresh. Run new suite plus setup, artifact-supply, starting-spells, starting-spell-transactions, encounter-setup-ownership and physical-setup-shuffle tests.
- [x] Save exact two-expression delta relative to `.superpowers/mystery-asset-setup-ownership/index.before.ts` as a minimal-context git patch without whitespace-only context. Validate reverse --check; update architecture status.
- [x] Sequential pnpm lint/typecheck/test/build, multiplayer included in test; default/Norman/Spell Playwright sequentially. One independent clean-context read-only final reviewer, material fixes RED→GREEN. Complete journal and commit only new test/docs/patch.

Self-review complete: scope and signatures match, each acceptance has a test, preservation explicit. Self-approved under user delegation.

## Execution journal

2026-10-23 preflight: HEAD2ed0624; prior iteration complete, no unfinished work. index.ts baseline saved exactly; other dirty files preserved. Spec0fb0dc2. Pinned .superpowers/pnpm.cmd, sequential checks, allowed loopback for multiplayer/browser tests.

Task 1 RED 9 failures/1 pass. Two independent starts from a shared Mystery catalog reject the second start in both grant modes; both families consume provider output even with later starting-grant cloning. Frozen output fails shift/splice; Mystery in-place output mutates content. Asset in-place catalog isolation already passes as expected.

GREEN 10/10 new, 94/94 combined seven suites. Implemented exactly two expressions: Mystery copies input and result; Asset copies result. Saved minimal one-line-context patch against exact baseline; normal reverse --check passes. No scope deviation.

Patch serialization initially mixed LF body with a CRLF final context line; normal reverse-check failed. Normalized only the saved patch to LF; source unchanged and normal reverse --check then passes. This is artifact formatting, not a production deviation.

Independent clean-context reviewer approved with no findings, independently ran 94/94 and verified exact two-expression baseline delta plus normal reverse patch check. Declined scopes: unrelated dirty foundation, arbitrary captured side effects, malformed/non-permutation providers and broader printed rules. Ruling: preserve those exclusions — this fixes demonstrated ownership isolation without new rule/error policy — cost if wrong: independent pre-existing defects are not covered; no broad readiness claim.

Sequential root checks: lint/typecheck/build 5/5 tasks each exit0; test 8/8 tasks, 1639 engine, 127 content, 21 protocol, 304 server. Existing Turbo outputs/npm environment/Playwright color warnings only. No dependency or unrelated source change.

Task 1 complete. Final Playwright default7/7, Norman2/2, Spell2/2, each exit0. All required checks passed sequentially without a test failure after GREEN. git diff --check and saved patch reverse --check exit0. Source patch is exactly2 insertions/2 deletions relative to the preserved dirty baseline; full index.ts remains outside index. Scope commit contains new test/docs/patch only. Current master retained under explicit authorization, no push/merge/worktree.
All verification refers to this dirty workspace, not a standalone clean checkout of its uncommitted prerequisites. No implementation deviation; only patch newline serialization corrected before commit.
Next orientation: recorded Cthulhu Research1 Wilderness/7 City Cultist ambush gap still exists in code (content accepts Cultist, engine parser only Deep One/Star Spawn). Ancient One content lacks typed Cultist combat checks, so inspect original sheets and choose the smallest verified dependency before writing new rules. Avoid an automatic broader RNG-hardening project.
