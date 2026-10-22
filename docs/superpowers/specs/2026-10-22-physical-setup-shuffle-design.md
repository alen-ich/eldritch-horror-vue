# Gate and Artifact setup shuffle integrity

## Goal and evidence

Continue the prior ownership iteration by securing the existing pure Gate/Artifact setup builders before extending rewards and encounters. `buildGateStack` and `buildArtifactDeck` in clean-at-entry `packages/engine/src/setup.ts` return unvalidated shuffle output and pass caller arrays directly to providers. A provider may delete/duplicate/replace physical IDs, mutate the caller catalog or retain a reference to returned engine storage. Location setup already validates conservation and returns an owned copy. Recorded Gate and Artifact setup requires one of each supplied physical token/card, with the first result representing the private top.

## Recommended approach and alternatives

Use a private helper in setup.ts for these two builders: snapshot expected IDs, pass a copy to shuffle, validate an array with exactly the same unique identities (including visiting sparse slots), then return a separate copy. Validate catalogs as nonempty dense arrays of unique strings; Artifact IDs retain the existing canonical pattern, Gate IDs retain existing nonempty-string compatibility. No global utility or new npm package.

Leaving validation to downstream draws accepts already corrupt setup and fails too late. Refactoring every RNG call into a universal transaction changes too many subsystems; defer that broader audit. Freezing external objects changes dependency-owned storage and is unnecessary.

## Boundaries and exclusions

Engine stays pure TypeScript and framework-independent. Server setup retains canonical ownership and existing command authorization/exception mapping. No protocol, public field or client rule changes; undrawn IDs remain private. No change to printed Gate count, Artifact effects, production readiness or empty optional-catalog handling in START_GAME. Mythos, Research/Expedition setup and Gate recycling are separate audit scopes.

## Acceptance

Both builders accept valid identity/reverse permutations, including a provider that shuffles its received copy in place, and preserve caller catalogs. Reject empty/duplicate/sparse/undefined/non-string input and malformed output (nonarray, omission, duplicate, extra, foreign, sparse), never installing invalid order. Mutating retained provider arrays and builder results is isolated in both directions. Existing error-message patterns for catalog rejection remain compatible. Test the real helpers plus a START_GAME malformed Artifact output through an existing transactional fixture; confirm unchanged lobby state. Root lint/typecheck/test/build, multiplayer suite and all three Playwright configurations pass.

## Approval

Full written-spec/plan cycle follows the user's requested workflow even for this small existing subsystem. Self-review complete: scope, authority, privacy, alternatives and tests are explicit. Self-approved under the user's delegated approval. Preserve unrelated dirty files; current setup.ts is clean.
