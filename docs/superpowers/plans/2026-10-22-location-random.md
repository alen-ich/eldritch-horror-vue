# Location random transaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL superpowers:executing-plans, inline as requested.

**Goal:** Atomic retained RNG input for Location draws and resumed decisions.
**Architecture:** Pure family wrapper around existing direct entry and explicit Location pending deck dispatch.
**Tech Stack:** existing TypeScript/Vitest/Mocha/Playwright; no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-22-location-random-design.md

## Task1 RED→GREEN
Create packages/engine/src/location-random.ts and test/location-random.test.ts. Modify dirty packages/engine/src/index.ts only for import, direct-entry wrapper/private Impl extraction and resumed decision boundary using existing locationEncounterDeckIds. Interfaces: withLocationRandomTransaction(context:EngineContext,run:()=>CommandResult):CommandResult; exported resolveLocationEncounter signature unchanged.
- [x] Write real-entry tests mirroring Research fixture with general deck and partial2-die test. RED direct/command partial dice and paid reroll after JSON restoration must return RANDOM_INPUT_REQUIRED, source unchanged, retained die still6. Test successful consumption, wrong owner and no-checkpoint compatibility.
- [x] Run `node node_modules/vitest/vitest.mjs run test/location-random.test.ts` from packages/engine; observe real failures before implementation.
- [x] Implement family wrapper, direct entry and explicit four-deck resume dispatch. Add helper tests restoring all four sequences on rejected result/exception, generic error sanitization, and regional resumed decision coverage.
- [x] Rerun focused and full engine; expected exit0.

## Task2 Review and verification
- [x] One independent clean-context read-only reviewer, material findings reproduced RED→GREEN.
- [x] pnpm lint/typecheck/test/build plus server integration (root test) and sequential default/Norman/Spell Playwright. Use documented bundled pnpm; permitted unrestricted localhost/build retry when required.
- [x] Write docs/architecture/location-random.md; save baseline-to-current index.ts patch and verify reverse applicability. Commit only newly authored module/tests/docs and scoped patch. Preserve original dirty inventory.

## Constraints/review focus
Four Location decks only; no Research/Other World wrapper regression. No new rule, hidden/public fields or discard/recycle implementation. Review successful input commit, exception sanitization, regional resume, wrong-owner behavior and no-checkpoint limitation; pin each with focused tests.

## Self-review and ledger
Spec and plan self-approved under delegated authority. Research candidate in scheduled instructions was stale; code confirms completion, so selecting the next Location prerequisite. Current HEAD c6535b7.

- Task1 RED: direct/command partial dice and JSON-restored paid reroll threw on consumed dice/IDs (3/6 failures). GREEN13/13 after family helper and explicit existing Location deck dispatch. No global transaction/error policy change.
- Ruling: retain per-family wrapper instead of refactoring duplicated transaction helpers; matches existing proven boundaries with minimal regression scope. Cost if wrong: small duplicated code until a separately justified shared contract.
- Ruling: index.ts already contains unrelated dirty prerequisites; preserve them, saving only exact integration delta as an already-applied patch. Reverse check exit0. Cost if wrong: scoped save requires this working-tree foundation; no standalone clean-checkout claim.
- Root baseline, independent review and browser checks running. Vitest installed3.2.7, TypeScript declared5.9.3; no framework API changes or package additions.
- Root lint/typecheck/build exit0 (5/5 each), root test exit0 (8/8): engine1440,content127,protocol21,server300. Browser suites running sequentially.
- Independent clean-context review: no actionable findings, focused13/13 independently green. Direct/initial-command checkpoint count and all four-deck resumed boundaries verified. Unrelated dirty prerequisites, complete subsystem certification and custom checkpoint implementations throwing outside the existing contract are not certified by this review. Ruling: retain existing checkpoint contract, since custom checkpoint failures are caller bugs outside this family repair; cost if wrong is a separate shared transaction-contract change.
- Default browser first run6/7: existing Norman Acquire case timed out waiting for its Sanity reroll. Trace retained as .superpowers/location-random/norman-failure-trace.zip; separate retry in progress. This failure is reported, not omitted or attributed to Location without evidence.
- Trace confirms the Norman case repeatedly received "cannot acquire Assets on a space containing a Monster" after random setup placed one in Arkham. An isolated retry passed1/1 but does not cover that blocked-start branch.
- Ruling: repair this browser baseline case by using existing legal Travel to adjacent numbered City5 when the Monster refusal occurs, collapse Reserve before the map click, and account for Travel consuming the extra action. RED observed in full E2E; no product/game rule changed. Cost if wrong: this test also depends on the existing Travel path. The pre-existing untracked test is preserved via a second exact delta in the integration patch. Full browser GREEN pending.
- Full browser rerun: Norman case now passed, but automatic-reconnect timed out45s during guest.goto before entering the room/game. Ruling: rerun the full unchanged test set with one worker to remove parallel dev-server load; no timeout increase or test skip. Cost if wrong: parallel performance remains unverified by a serial green result. Dedicated configurations still run sequentially.
- Full serial E2E7/7 exit0. Initial failures are preserved above; no hidden retries or skipped cases. Initial dirty-path inventory remains intact; new location-random source/test were absent initially and are authored in this iteration. Dedicated Norman/Spell checks pending.

- Task2 complete: final serial default Playwright7/7, Norman2/2, Spell2/2; all exit0. Root lint/typecheck/test/build green as recorded above. Independent review no actionable findings. Reverse patch and git diff --check exit0. Existing Nuxt/color/Turbo warnings only. Original dirty inventory preserved; scoped local commit, no push/merge/deploy. Automation updated to point at current status rather than reselect completed Research work.
