# Scan-verified Expedition mechanical catalog

## Goal and evidence
Establish the next prerequisite for safe Expedition encounter execution: verified mechanics for all 18 physical fronts. Setup now conserves one private deck and exposes only its back location; no Expedition instructions exist. All eight front source images were visually inspected in this iteration. No further scans are needed. Himalayas source order is 2,1,3; Antarctica1 uses Will after its initial Strength test, and Pyramids3's pass follow-up loses Health rather than Sanity.

## Scope and design
Add a content-only descriptive catalog, joined by physical ID to the existing scan manifest/setup metadata. Each entry contains canonical location/number/source scan/cell, verification=mechanics_verified_from_scan, effectStatus=not_executable, and initial/pass/fail mechanical summaries. Every pass/fail section also records its skill and modifier explicitly. Initial is a test or the exceptional Himalayas1 spawn-and-immediately-encounter-Monster operation, whose defeat chooses the pass branch. Text preserves effect ordering, exact amounts/Condition kinds and whether a reward precedes or follows a test. No flavor text is needed.

Strict schemas validate shape and complete physical coverage; canonical comparisons reject altered mechanics/source bindings, duplicates and missing entries. Regression tests independently pin the nonuniform cards and source-image SHA256 hashes, so replacing sources requires verification again. This is descriptive data, never interpreted at runtime. Existing Expedition scan entries and readiness remain not_executable/needs_review.

## Alternatives
Transcribing only a convenient top card leaves the shuffled physical deck largely unaudited. Adding a universal effect DSL now mixes source verification with execution and would expose unsupported Artifact rewards and spawn/combat timing. A descriptive, typed catalog is the smallest complete source-verification dependency; later execution must translate supported entries into the existing interpreter under guards.

## Authority and privacy
No engine/server command, game-state transition, synchronization or private deck behavior changes. Static mechanical descriptions are safe public reference data like the already public fronts. Joining content IDs never reveals which front is currently on top; the production server does not consume the new catalog as executable rules.

## Acceptance and tests
Exactly 18 entries match the existing physical catalog, three per location. Printed numbering/cells remain correct for Himalayas2/1/3 and split Amazon/Antarctica sheets. Every printed test has the correct skill/modifier; unconditional prefix effects are explicit. Mutation of skill, amount, source, status or physical identity rejects. Source hashes cover all eight inspected fronts. Root checks, multiplayer and all browser suites remain green with no gameplay expansion.

## Exclusions and approval
No Expedition command, card draw/cycle, rewards, generic Artifact gain, Monster combat continuation or family readiness promotion. Self-review: a bounded content verification prerequisite with explicit execution exclusion; approved under user delegation. Native current-branch execution, preserve unrelated changes, no commits or publication.
