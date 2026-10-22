# Cthulhu Cultist profile implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline with test-driven-development.

**Goal:** Supply verified typed Cthulhu Cultist front/back combat metadata and correct Strength timing.
**Architecture:** Existing Ancient One data/schema validation; no live engine execution change.
**Tech stack:** TypeScript5.9.3, Zod4.6.5, Vitest3.2.7, pnpm10.28.0. No package changes.
**Spec:** ../specs/2026-10-23-cthulhu-cultist-profile-design.md

## Global constraints

Keep server authority/private-state boundary unchanged. Current branch/directory, no worktree/push/merge. No Cultist execution/readiness claim. Selected source/test/docs clean at entry; dirty export-star barrel need not change.

## Review focus

Strength versus Will timing; null Horror meaning no test; front/back toughness and loss differences; permissive/partial profile validation; accidental activation of unverified other AOs. Task1 covers all five.

## Task1: Verified content prerequisite

**Files:** Modify `packages/content/src/ancient-ones.ts`, `docs/rules/base-game-ancient-ones.md`; create `packages/content/test/cthulhu-cultist-profile.test.ts`, `docs/architecture/cthulhu-cultist-profile.md`.
**Interfaces:** New exported CultistCombatProfile { horrorCheck: {skill:"will";modifier:number;damage:number}|null; damageCheck:{skill:"strength";modifier:number;damage:number}|null; beforeStrengthSanityLoss:number }. AncientOneData.cultist gains normalCombat?/awakenedCombat?:CultistCombatProfile. Existing validateAncientOneContent(ancientOnes:readonly AncientOneData[]):void remains signature-compatible.

- [x] RED: Pin both Cthulhu profiles from inspected image: horror null, Strength0/Damage1, loss1/2, toughness1/2 and new pre_strength IDs. Positive validator fixture injects canonical profiles and accepts. Verify exact image hash e408dceaf95bc679579b1e40d30bb688191ad06be80925d6efab24daadb8e77a.
- [x] RED: For both sides reject missing profile/required check, unknown profile/check keys, wrong skill/Horror/modifier/damage, null Damage, swapped/zero/negative/fractional/NaN loss, wrong toughness and old pre_will ID. Reject profiles on each other AO; Monster Cultist placeholders remain ancient_one.
- [x] Run `pnpm --filter @eldritch/content exec vitest run test/cthulhu-cultist-profile.test.ts`; inspect absent-profile/old-timing/positive-schema failures.
- [x] GREEN: Define typed profiles/strict nested schemas, add scan values and corrected IDs. Existing roster validator requires canonical Cthulhu values/IDs/toughness and refuses unverified profiles on other AOs. Preserve existing roster checks. No barrel modification (already export-star).
- [x] Run focused content new/ancient-ones/monsters/research-encounter-rules suites; engine Research/ambush suites confirm unchanged guards. Update clean rule status and architecture docs.
- [x] One independent clean-context read-only reviewer compares source image, metadata, schema and tests. Material findings reproduced RED, fixed GREEN. Sequential root lint/typecheck/test/build, multiplayer and default/Norman/Spell Playwright. Record actual outcomes and scoped commit.

Self-review: source values and null semantics explicit; interfaces/tests align; partial coverage and exclusions clear. Self-approved.

## Execution journal

2026-10-23 preflight HEAD6ea1338, no unfinished iteration. Source/test/rule doc selected here clean. Cthulhu local jpg visually checked and SHA verified against recorded value. Installed versions inspected, no framework APIs changed. Effect-ID search found only the two metadata declarations, no consuming code. Spec099f62b. Normal startup/room behavior stays guarded.

Task1 RED2 failures/37 passes: existing corpus lacks typed profiles/correct timing; positive fixture with canonical new profiles rejected by old strict schema. Negative cases already rejected as unknown fields at baseline. GREEN39/39 new and55/55 related content tests. Implemented strict nested profiles, exact Cthulhu front/back validation, timing ID correction and rejection of unverified other AO profiles; no runtime handler or dirty-barrel edit. Selected clean files may be committed normally, no patch required.

Research/continuation regression82/82 passed; existing Cultist guards unchanged. Independent clean-context reviewer inspected both image sides and confirmed all values/timing, found no severity-graded findings and independently passed55/55 content tests. Live sequencing/defeat/rerolls/restoration/awakening and unrelated dirty code were outside that content review; no execution/readiness claim is made.

Initial root lint failed in server compilation (TS7018 null inferred as any, TS2339 unknown stage properties, TS2345 Zod nullable profiles inferred as optional) because server tsconfig has strictNullChecks:false. Explicitly annotated the two null metadata fields and kept the validator's original typed input loop after schema validation; did not alter server tsconfig or validation semantics. Root lint GREEN5/5 after correction. This is compatibility repair verified by the actual failed/passing repository compiler check, not an engine behavior expansion. Remaining full checks rerun on that source.

Task1 complete. Final sequential verification: lint5/5 after null-type compatibility repair, typecheck5/5, test8/8 (content166, engine1639, protocol21, server304), build5/5. Playwright default7/7, Norman2/2, Spell2/2, each exit0. git diff --check exit0. First lint failure and corrective compiler evidence recorded above; no unresolved check or gameplay issue introduced.
Preservation: only the selected clean-at-entry source/rule doc plus new test/architecture/plan are staged. Original dirty content export barrel, engine, server, web, browser tests and prior untracked foundations are untouched by this iteration. Unlike the previous dirty-source iterations, this clean source can be committed directly; no integration patch is needed. All full-project results still refer to the current working directory with its pre-existing dirty prerequisites, not a claim about a clean checkout. No dependency or runtime rule added. Current branch retained, no push/merge.
Next: pure engine Ancient One-aware Cultist resolution, explicitly skipping absent Horror and ordering Sanity loss before Strength/defeat. Begin with the verified Cthulhu normal profile; awakened live execution and other AO profiles remain unsupported until separately designed. Engine must not import content/runtime frameworks; any needed attributes cross the existing server/content boundary as typed primitives. Verify current bindings/guards before implementation.
