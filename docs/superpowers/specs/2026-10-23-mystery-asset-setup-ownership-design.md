# Mystery/Asset setup ownership

## Goal and code evidence

Preserve shared content and independent game setup before adding more rule effects. START_GAME passes the selected content-owned Mystery array to shuffle, then shifts its result; a provider returning its input lets the engine remove a card from the shared content catalog. Another lobby using that catalog can then fail the four-Mystery preflight. Mystery/Asset provider outputs are also shifted/spliced directly and retained in canonical state, so provider storage can be changed during setup or mutate state later. Downstream starting-Spell cloning does not undo content mutation or earlier provider-array consumption.

## Recommended design and alternatives

Copy Mystery input before passing it to the provider, and copy the two provider outputs before consuming/storing them. Asset input is already a fresh filtered array, so a second input copy is unnecessary. Preserve selection, order, reserve size, starting grants, errors and existing transaction wrappers. No new helper/package.

Cloning the entire GameContent tree is unnecessarily broad and expensive. Relying on later game-state clones does not fix shared content or provider arrays already consumed by shift/splice. A universal shuffle validator would add permutation/error semantics outside this proven ownership defect; defer that separate topic rather than bundle it here.

## Authority, privacy and exclusions

Pure TypeScript engine, current branch/directory, no network/client/protocol changes. Server owns canonical results. Remaining deck order stays private; active Mystery and Reserve remain public. No card effect, printed rule, readiness promotion, catalog/schema policy or arbitrary provider-captured side-effect guarantee. Existing providers may return identity, reversed, frozen or in-place-permuted arrays; engine operations must use engine-owned storage.

## Acceptance and tests

Two real START_GAME calls using the same content both succeed when the targeted Mystery provider returns its input; content is unchanged, and independent results do not share mutable storage. Cover both starting-Spell grant and no-grant paths. For each family a retained full provider permutation remains unconsumed by engine shift/splice, and mutations after start cannot cross between provider output and canonical remaining order. Frozen and in-place provider permutations remain usable. Literal reverse order yields active Mystery four, remaining three/two/one, Reserve f/e/d/c and Assets b/a. Input state/content are unchanged, version increments once, and projections expose no remaining IDs. Existing setup/starting-Spell regression suites, root lint/typecheck/test/build, multiplayer and all three Playwright configurations must pass sequentially. One clean-context independent final reviewer.

## Preservation and approval

index.ts already has unrelated uncommitted changes. Save exact baseline and commit only this iteration's already-applied source delta as a patch, plus new test/docs; never stage the full index.ts. Patch requires the existing foundation and is not a standalone clean-checkout implementation. Self-review complete, no placeholders/contradictions. Self-approved under the user's explicit delegated approval and full written-workflow preference.
