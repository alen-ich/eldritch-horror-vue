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

- Personal Assistant adds one die and an optional one-die free reroll to Influence tests in the generic test lifecycle (including Acquire Assets) and supported location/Research. Its reroll can be used once per test, independently of Clue rerolls, and consumed-source tracking survives serialization. It does not grant a bonus or reroll to another skill.
- Fine Clothes makes each 6 count as two successes during Acquire Assets.
- King James Bible recovers one additional Sanity during Rest. Its combat reroll remains pending combat tests.
- Private Care immediately restores Health and Sanity to maximum, then enters the Asset discard pile.
- Urban Guide grants one additional die to investigators on its holder's City space during supported non-combat location/Research tests. It is a non-Item aura and combines with improvements before the minimum-one-die rule. Defeated/eliminated and remote holders do not contribute. Other World, board combat, ambush and Action-test integration remain pending.

## Scoped encounter applicability (3 October 2026)

Eight generated English fronts were visually checked. `nonCombatEncounterSupport` marks Urban Guide's supported aura and seven Assets with no applicable printed effect in this scope: Arcane Manuscripts, Fine Clothes, King James Bible, Protective Amulet, .38 Revolver, .45 Automatic and Holy Cross. These seven may be carried during supported non-combat location/Research without incorrectly applying their Spell/Acquire/Rest/combat effects. Empty `engineEffects` alone never authorizes a card; unknown/missing metadata and the other 32 Assets remain guarded.

`packages/engine/src/encounter-assets.ts` owns branch-wide possession preflight and same-City aura calculation. `GameRoom.ts` passes the explicit metadata from content to the pure engine; no new network command or client-owned result is added. Any nested ambush with a carried Asset or local Urban Guide aura still rejects before the first Research roll, because combat bonuses/reactions are not integrated. The original Item-discard guard has now been replaced by the conservation-checked choices described below.

Seventeen engine cases plus a content test and a room regression cover scoped applicability, owner/colleague aura, remote/defeated/eliminated exclusions, Sea exclusion, ordinary Lore versus Spell-only Manuscripts, minimum dice, physical-Clue rerolls, serialization/ownership and atomic branch guards. This reduces blanket Asset blocking; it does not remove Reckoning, combat, reaction/reroll or general possession limitations. Next: encounter Asset-granted test rerolls and global skill bonuses, starting with Personal Assistant.

The engine never parses `effectText`. Cards without typed nodes remain display-only until their prerequisites and verified handlers are present.

## Personal Assistant follow-up (3 October 2026)

The generated English front was visually verified: the +1 die and optional reroll both apply to Influence. The card now uses `skill_test` applicability, bringing the supported non-combat roster to nine cards; the other 31 remain guarded. The prior eight-card paragraph records the earlier slice, not the current count.

`ActiveTest.usedRerollAssetIds` records physical sources consumed in the current test. Owner-private options distinguish `die-N` (spend a physical Clue) from `asset-reroll:asset_personal_assistant:N` (no Clue). After each reroll the server offers only remaining legal sources; keeping the result declines all remaining rerolls and resumes the original continuation. Tests can reroll the same die using different sources, but cannot reuse Personal Assistant in the same test. A new test starts with unused sources. Fixed, non-test rolls are unchanged.

Engine tests cover no-Clue availability, combined Ally bonuses, refusal, new-test reset, both source orders, restoration, ownership, consumed-source rejection and other-skill exclusion. A real room regression verifies Acquire Assets and restoration; the browser regression uses Charlie Kane's starting Personal Assistant and explicitly selects the free source. The browser displays source-specific labels rather than describing every reroll as a Clue payment.

Combat/ambush, Other World, and other card-specific reaction timing are not enabled by the Personal Assistant change. Its next planned slice, Research Item-discard choices, is now implemented below.

## Research Item-discard continuation (3 October 2026)

Cthulhu Research 3 City failure discards one Item Asset; card 6 Wilderness failure discards two, then relocates this Clue to the nearest Sea. Both generated fronts were visually rechecked. The interpreter now offers one mandatory owner-private `encounter_choice` per Item, updating the remaining printed count between choices. With fewer Items, it discards all available Items and proceeds; with none, no Item choice is created. Allies are never eligible. A successful Research test never discards an Item.

`encounterItemAssetIds` filters by structured traits. `encounterItemsAreConserved` checks that every eligible physical ID exists exactly once across living holdings, defeated sheets, Reserve, private Asset deck and discard pile. This targeted check runs before the Research test, before offering each choice, and again on acceptance. Unknown/unsupported possessions retain their ordinary applicability guards; this is not a whole-40-card supply validator.

On acceptance, the engine removes exactly the chosen held ID, appends it to `assetDiscardIds`, emits `ASSET_DISCARDED` with reason `encounter`, and resumes the private queue. No Reserve refill, Asset draw, Clue payment or combat reward occurs. The existing browser Encounter choice panel sends the selected ID using the already runtime-validated `RESOLVE_DECISION` command. The server stores choices/queue privately; restoration does not repeat a discard. The Research card cycles only after all discards and any nearest-Sea choice finish.

Twelve new engine cases cover success, one/two discards, shortage/zero Items, sequential restoration, nearest-Sea ordering, physical Clue preservation, invalid/refused/remote/vanished selections and duplicate IDs in all physical locations. The room regression exercises two actual clients, restoration after the first discard, owner authorization, private state filtering and final handoff. Next scan-independent Asset slice: Lucky Rabbit's Foot's optional test reroll, using its existing scan. Combat/ambush and the other 31 unsupported Assets remain separate work.

The scanned **Rally the People** Mythos Event now grants the Lead the first Ally in the private shuffled Asset deck, falling back to the discard pile if necessary and reshuffling the deck after a gain. The granted physical card leaves its source pile and becomes the Lead's possession; if no Ally remains in either pile, no card is gained. The remaining deck order is never synchronized to clients.

Run `pnpm assets:generate` to reproduce the 40 WebP fronts and shared back under `apps/web/public/cards/assets` from the committed sources.
