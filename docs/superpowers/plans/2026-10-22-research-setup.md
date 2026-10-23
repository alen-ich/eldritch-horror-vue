# Physical Research setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL superpowers:executing-plans inline, TDD and final clean-context review.

**Goal:** Initialize physical Research decks independently of executable instructions.
**Architecture:** Optional full32 setup catalog, pure validator/shuffler and setup RNG transaction; production uses existing scans.
**Tech Stack:** Installed TypeScript/Vitest3.2.7, Colyseus0.18.5/SDK0.18.2; no package install.
**Spec:** docs/superpowers/specs/2026-10-22-research-setup-design.md

## Global constraints
Current directory/branch; preserve unrelated dirty changes. No commit/push/merge/deploy, readiness promotion or new effects. Approval delegated. Hidden order stays private.

## Review focus
All four Ancient One selections; malformed/sparse full catalog; shuffle must conserve selected eight; rejected setup restores consumed input; supplied invalid catalog never falls back. Tests in Task1 cover each, Task2 covers real room privacy.

## Task1: Pure setup
Files: new packages/engine/src/research-setup.ts and test/research-setup.test.ts; modify packages/engine/src/index.ts.
Interfaces: ResearchSetupCard{id:string;deck:ResearchEncounterDeckId}; validateResearchSetupCatalog(cards:readonly ResearchSetupCard[]):string|undefined; initializeResearchDeck(cards,deck,shuffle):string[]; withResearchSetupRandomTransaction(context,run):CommandResult. Add optional GameContent.researchEncounterSetup; export pure helpers. Existing APIs unchanged.
- [x] RED synthetic existing START_GAME fixture with full32 data but no researchEncounters: all four choices should get eight, private projection hides order. Invalid metadata variants reject with zero random calls. Bad shuffle/partial input rolls back. Legacy no-field setup remains unchanged. Run focused Vitest and observe failure.
- [x] GREEN add validation before setup randomness, selected-deck shuffle in place of rule-derived branch when configured; use checkpoint wrapper for START_GAME without double setup wrapper (covers all setup random consumption). Rerun focused/full engine tests and typecheck.

## Task2: Production wiring and multiplayer
Files: apps/server/src/rooms/GameRoom.ts, new apps/server/test/ResearchSetup.test.ts, registration in apps/server/test/GameRoom.test.ts.
- [x] RED real two-client rooms select each Ancient One, start and assert canonical selected8/private JSON restore/public peer filtering. Shub/Yog fail missing deck before wiring.
- [x] GREEN pass research family records from baseGameScannedTokenEncounters as setup catalog. Run server tests. Actual unsupported-top draw must still fail without skip; no new effects claimed.
- [x] Update docs/architecture/research-setup.md with exact scope/next prerequisites.

## Task3: Review and checks
- [x] One independent clean-context review against baseline copies. Reproduce significant findings RED, fix GREEN.
- [x] Root pnpm lint/typecheck/test/build; default and dedicated Playwright suites sequentially, expanded localhost permissions. Record actual results, verify scoped diff and git diff --check.

## Self-review and ledger
All requirements mapped to catalog validation, initialization, existing refusal and real room privacy. Names/types consistent. Self-approved. Ruling: physical setup before Research integrity/discard, because executable rules are an incomplete physical catalog; cost is those documented lifecycle gaps remain.
- Task1 RED11/12 failures on missing inventory/metadata checks; GREEN12/12 plus Expedition setup16/16. Existing downstream Spell setup can return its specific random error; retained-input regression checks rejection plus actual rollback instead of replacing that established error code. No new readiness claim.
- Task2 real multiplayer RED2/4: Shub/Yog lacked decks. GREEN4/4 after production catalog wiring; all32 canonical IDs stay private, selected8 exact JSON order retained, unsupported Shub/Yog top rejects without mutation. Server typecheck exit0.
- Full baseline after implementation: lint/typecheck/test exit0 (server294). Build and all three browser configs running sequentially. Bundled pnpm uses unchanged installed dependencies with auto repair disabled; local socket tests run with expanded permissions.
- Independent review P2: mutating shuffle changed the ids array used as its own conservation baseline. Reproduced RED at START_GAME accepting a foreign card. Fixed membership validation against independent canonicalDecks map; GREEN13/13 Research plus16/16 Expedition. Original state/catalog unchanged; no deferred findings.
- Review repair typecheck initially exposed an inferred template-literal Map key incompatible with arbitrary string output. Added explicit Map<string,ResearchEncounterDeckId>; final lint/typecheck/test exit0. This preserves runtime checking of foreign output rather than casting it trusted. Final sequential build/browser rerun started after all earlier dev processes exited.
- Final post-review checks complete: lint/typecheck/test/build exit0, engine1366/content127/protocol21/server294 (1808 total); Playwright default7/7, Norman2/2, Spell2/2 exit0. Scope reviewed; git diff --check clean except pre-existing line-ending notices. No deferred reviewer findings, no package installation, no Git index/history mutation.
- Next iteration discovery: Research restoration currently has no shared catalog/conservation validator. Before migrating physical discard it must reject missing/duplicate/unknown/incomplete inventory and wrong top-bound continuations atomically; use the new full physical setup catalog rather than the incomplete executable catalog. Research/Location bottom cycling and untranscribed effects remain explicit gaps.
