# Base-game Asset cards

The supplied archive contains exactly 40 individually named English Asset fronts, matching the base-game component count. No expansion cards were found.

`packages/content/src/assets.ts` provides stable IDs, printed English titles, values, normalized traits, timing categories, effect text, source-image references, and generated front/back URLs for the complete roster. Validation requires exactly 40 unique IDs and titles, legal values and categories, nonempty effect text, and matching source and browser image names. Investigator records now cross-reference all ten printed starting Assets by stable ID while retaining the original setup text for non-Asset possessions.

The supplied JSON is retained as source data under `source-assets/assets`, and `pnpm assets:data` deterministically generates the normalized TypeScript definitions. The complete shared Asset back is supplied, generated, and required by content validation.

The Asset family remains `needs_review` rather than `verified` because:

- the transcribed effects still need comprehensive card-by-card scan verification;
- most Asset effects still depend on unimplemented tests, combat, encounters, Conditions, Spells, Clues, Monsters, or component actions.

## Engine coverage

The authoritative engine now removes starting Assets from the deck, grants them by stable ID, shuffles the remaining deck privately, and exposes a four-card Reserve. Acquire Assets uses the generic Influence-test lifecycle, including improvements, supported bonuses, and sequential Clue rerolls; it then validates selected cards against total successes, refills the Reserve, and supports the optional one-card discard after buying nothing. Active tests and owner-only choices survive serialization and reconnection. Bank Loan is intentionally unavailable until Debt Conditions are implemented.

Five cards have explicit typed effect nodes and executable tests (coverage is scoped, not full-family support):

- Personal Assistant adds one die to Influence tests, including Acquire Assets. Its optional reroll remains pending the general test/reroll system.
- Fine Clothes makes each 6 count as two successes during Acquire Assets.
- King James Bible recovers one additional Sanity during Rest. Its combat reroll remains pending combat tests.
- Private Care immediately restores Health and Sanity to maximum, then enters the Asset discard pile.
- Urban Guide grants one additional die to investigators on its holder's City space during supported non-combat location/Research tests. It is a non-Item aura and combines with improvements before the minimum-one-die rule. Defeated/eliminated and remote holders do not contribute. Other World, board combat, ambush and Action-test integration remain pending.

## Scoped encounter applicability (3 October 2026)

Eight generated English fronts were visually checked. `nonCombatEncounterSupport` marks Urban Guide's supported aura and seven Assets with no applicable printed effect in this scope: Arcane Manuscripts, Fine Clothes, King James Bible, Protective Amulet, .38 Revolver, .45 Automatic and Holy Cross. These seven may be carried during supported non-combat location/Research without incorrectly applying their Spell/Acquire/Rest/combat effects. Empty `engineEffects` alone never authorizes a card; unknown/missing metadata and the other 32 Assets remain guarded.

`packages/engine/src/encounter-assets.ts` owns branch-wide possession preflight and same-City aura calculation. `GameRoom.ts` passes the explicit metadata from content to the pure engine; no new network command or client-owned result is added. Any nested ambush with a carried Asset or local Urban Guide aura still rejects before the first Research roll, because combat bonuses/reactions are not integrated. A Research Item-discard branch rejects if the investigator carries an Item, but may proceed for Urban Guide alone: an Ally is not an Item.

Seventeen engine cases plus a content test and a room regression cover scoped applicability, owner/colleague aura, remote/defeated/eliminated exclusions, Sea exclusion, ordinary Lore versus Spell-only Manuscripts, minimum dice, physical-Clue rerolls, serialization/ownership and atomic branch guards. This reduces blanket Asset blocking; it does not remove Reckoning, combat, reaction/reroll or general possession limitations. Next: encounter Asset-granted test rerolls and global skill bonuses, starting with Personal Assistant.

The engine never parses `effectText`. Cards without typed nodes remain display-only until their prerequisites and verified handlers are present.

The scanned **Rally the People** Mythos Event now grants the Lead the first Ally in the private shuffled Asset deck, falling back to the discard pile if necessary and reshuffling the deck after a gain. The granted physical card leaves its source pile and becomes the Lead's possession; if no Ally remains in either pile, no card is gained. The remaining deck order is never synchronized to clients.

Run `pnpm assets:generate` to reproduce the 40 WebP fronts and shared back under `apps/web/public/cards/assets` from the committed sources.
