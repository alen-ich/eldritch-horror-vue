# Staged Mythos setup integrity

## Intent and evidence

Next prerequisite after Gate/Artifact setup is conservation during staged Mythos construction. `buildMythosDeck` currently trusts all six shuffle results (three color pools, three stages). Missing/duplicate/foreign output can silently shorten or corrupt the deck. Sparse stage/catalog arrays evade callback-based checks. Existing setup tests cover valid stage order, shortages and duplicate catalogs, not malformed provider output.

## Design and alternatives

Reuse the private checked physical-ID shuffle helper introduced in the preceding iteration for each color pool and stage. Validate a dense catalog of nonempty unique IDs with legal colors and exactly three dense stage records before consuming random input; retain existing integer/nonnegative/count-shortage checks. Each stage must contain its specified counts selected from disjoint color pools, with stage I before II before III. Unselected cards remain excluded; an intentionally all-zero setup stays valid. Provider in-place permutations are allowed on copies and returned arrays are detached.

Prefer the existing helper over a separate validator per color/stage: one established conservation boundary with no new abstraction/package. Checking only the final deck misses color/stage swaps and corrupt intermediate pools. Rewriting all setup transactions is wider than this defect; keep existing callers and exception mapping.

## Scope, authority and privacy

Pure TypeScript setup.ts and focused engine tests; unchanged public signature and protocol. Server owns setup and selected order stays private. No card effect, Mythos icon, Rumor, Ancient One, readiness or client behavior changes. Preserve unrelated working-tree changes and current branch. No additional dependency.

## Acceptance

Reject malformed/sparse catalogs or stage entries before shuffle calls. For each of six shuffle sites reject omissions, extra IDs, duplicates, foreign IDs, sparse/nonarray output and input-mutating attempts to redefine the expected inventory. Accept deterministic identity and reversed permutations with existing literal stage order. Preserve source catalog/stages. A provider reusing the same mutable array across calls cannot corrupt earlier pools; mutating retained results after return cannot alter the final deck. Zero-size pools/stages remain supported. Real START_GAME via the existing transactional fixture rejects malformed Mythos output atomically and restores consumed deterministic input. Run focused tests, root lint/typecheck/test/build, multiplayer and all three Playwright configurations. One independent clean-context final reviewer.

## Self-review and approval

No placeholders/contradictions; source evidence confirms gap. Spec self-approved under the user's explicit delegated approval. Next step is writing-plans, then inline execution with TDD.
