# Research/Expedition setup array ownership

## Goal and evidence

Next dependency after checked Mythos setup is engine-owned storage for the physical Research and Expedition setup decks. Both initializers validate physical IDs but return provider-owned arrays directly. START_GAME without a starting Spell grant or board-token placement can return these references unchanged. Later cloning on other paths must be tested as a compatibility control rather than assumed to protect every setup.

## Design and alternatives

Copy validated Research order and Expedition deck at their return boundaries. Keep signatures, deterministic order, Expedition marker derivation and every validation/error/transaction rule unchanged. No package is needed. Freezing provider output mutates external storage; cloning the whole game for every initializer is wider and more expensive than owning string arrays locally. Omitting the fix because Norman setup later clones leaves non-grant setup exposed.

## Authority, privacy and scope

Pure engine TypeScript only. Server owns canonical state; private remaining IDs never synchronize, and clients get only the existing public Expedition site. No network input, new command, public field, encounter effect or readiness promotion. No arbitrary proxy/getter/provider-captured side-effect guarantees. Source files were already untracked at entry: preserve their exact prior foundation and save ONLY this iteration's already-applied source delta as a committed patch; do not stage their full contents. The patch requires the existing foundation and is not a standalone clean-checkout feature.

## Acceptance

Real START_GAME with no starting Spell grant rejects retained-reference mutation: changing a provider array after command return cannot alter engine private order or make the Expedition marker inconsistent; changing the returned deck cannot change provider storage. Verify all four selected Research decks, Expedition reversed order/top site, original input/catalog immutability and private/public projections. Starting Spell grant paths remain valid controls, and frozen/in-place provider permutations remain supported. Existing invalid catalog/output/rollback/setup/discard tests pass. Run root lint/typecheck/test/build sequentially, server multiplayer tests and default/Norman/Spell Playwright sequentially. One independent clean-context final reviewer checks the precise source delta, tests and patch.

## Self-review and approval

Bounded behavioral fix follows the full written spec/plan workflow explicitly requested by the user. No placeholders or contradictions; acceptance covers both exposed command paths and cloning controls. Self-approved under delegated approval. Framework APIs and installed dependencies remain unchanged (pnpm 10.28.0, Vitest 3.2.7).
