# Base-game Asset cards

The supplied archive contains exactly 40 individually named English Asset fronts, matching the base-game component count. No expansion cards were found.

`packages/content/src/assets.ts` provides stable IDs, printed English titles, values, normalized traits, timing categories, effect text, source-image references, and generated front/back URLs for the complete roster. Validation requires exactly 40 unique IDs and titles, legal values and categories, nonempty effect text, and matching source and browser image names. Investigator records now cross-reference all ten printed starting Assets by stable ID while retaining the original setup text for non-Asset possessions.

The supplied JSON is retained as source data under `source-assets/assets`, and `pnpm assets:data` deterministically generates the normalized TypeScript definitions. The complete shared Asset back is supplied, generated, and required by content validation.

The Asset family remains `needs_review` rather than `verified` because:

- the transcribed effects still need comprehensive card-by-card scan verification;
- most Asset effects still depend on unimplemented tests, combat, encounters, Conditions, Spells, Clues, Monsters, or component actions.

## Engine coverage

The authoritative engine now removes starting Assets from the deck, grants them by stable ID, shuffles the remaining deck privately, and exposes a four-card Reserve. Acquire Assets uses the generic Influence-test lifecycle, including improvements, supported bonuses, and sequential Clue rerolls; it then validates selected cards against total successes, refills the Reserve, and supports the optional one-card discard after buying nothing. Active tests and owner-only choices survive serialization and reconnection. Bank Loan is intentionally unavailable until Debt Conditions are implemented.

Twelve cards have explicit typed effect nodes and executable tests (coverage is scoped, not full-family support):

- Personal Assistant adds one die and an optional one-die free reroll to Influence tests in the generic test lifecycle (including Acquire Assets) and supported location/Research. Its reroll can be used once per test, independently of Clue rerolls, and consumed-source tracking survives serialization. It does not grant a bonus or reroll to another skill.
- Fine Clothes makes each 6 count as two successes during Acquire Assets.
- King James Bible recovers one additional Sanity during Rest. Its combat reroll remains pending combat tests.
- Private Care immediately restores Health and Sanity to maximum, then enters the Asset discard pile.
- Urban Guide grants one additional die to investigators on its holder's City space during supported non-combat location/Research, Puzzle Box and the three supported Artifact Lore tests. It is a non-Item aura and combines with improvements before the minimum-one-die rule. Defeated/eliminated and remote holders do not contribute. Other World, board combat, ambush and other Action-test integrations remain pending.
- Lucky Rabbit's Foot grants an optional one-die reroll during supported tests, once per physical card per round. It grants no dice bonus. Combat/ambush and Other World remain guarded.
- Hired Muscle adds one Strength die and an optional free Strength-test reroll for its holder in supported non-combat tests. It is an Ally bonus, not an Item bonus or City aura. Combat remains separate.
- Bandages optionally discards its physical Item to prevent one or two Health loss for a same-space investigator during ordinary location/Research damage. It does not heal or prevent Sanity loss. Other damage contexts and paid Health costs are not enabled.
- Whiskey optionally discards its physical Item to prevent one or two Sanity loss for a same-space investigator during ordinary location/Research damage. It does not heal or prevent Health loss. Other damage contexts and paid Sanity costs are not enabled.
- Lucky Cigarette Case optionally increases one test die result by one, once per physical card per round, in the shared test lifecycle and ordinary location/Research. It is not a reroll, extra die or Clue payment. Results above six and combat/Other World integration are not enabled.
- Witch Doctor offers investigators on its holder's space an optional additional Health recovery or Cursed discard during Rest, after ordinary recovery and Injury/Madness recovery rolls.
- Puzzle Box offers its holder an optional Observation −2 test during Rest. Passing discards the Box and draws the top Artifact only when its gain/effects are supported; other Artifact draws remain guarded.

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

Twelve new engine cases cover success, one/two discards, shortage/zero Items, sequential restoration, nearest-Sea ordering, physical Clue preservation, invalid/refused/remote/vanished selections and duplicate IDs in all physical locations. The room regression exercises two actual clients, restoration after the first discard, owner authorization, private state filtering and final handoff. Its planned Lucky Rabbit's Foot follow-up is implemented below.

## Lucky Rabbit's Foot: round-limited rerolls (3 October 2026)

The existing generated English front was visually verified. Its optional reroll applies to any skill test, once per round, with no Clue cost. The printed trait is `Trinket`, not `Item`; it is not eligible for Cthulhu's Item Asset discards. Its `round_test_reroll` node and `skill_test` applicability bring the non-combat roster to ten Assets; the other 30 remain guarded. Earlier eight/nine-card counts record prior slices.

`GameState.usedAssetRerollIds` tracks physical source IDs across tests in the current round. `ActiveTest.usedRerollAssetIds` separately tracks sources used in the current test. Using the Foot updates both; Personal Assistant updates only the test-local list. A Clue reroll changes neither list. Declining does not consume the Foot. Different effects can reroll the same die, but a consumed source cannot be selected again. Changing owners or losing/reacquiring the same physical card does not refresh round usage. The authorized `BEGIN_NEXT_ROUND` transition clears the round list; starting a new test does not.

The room schema and content adapter round-trip the public used-ID list and card display names. Owner-private options now label the actual card rather than hardcoding Personal Assistant. Commands, dice, thresholds and outcomes remain server-authoritative; fixed non-test dice never enter this reroll flow. Missing usage arrays in older states mean no recorded usage. No Other World or possession-aware combat integration is enabled.

Fifteen new engine cases cover five skills, Research/physical Clues, no dice bonus, round persistence, decline, source order, ownership/restoration, next-round authorization, public-copy safety, lost/used source rejection, Cursed thresholds and Trinket exclusion. A two-client room regression checks the adapter, independent source choices, consumed-source rejection and next-round reset. The browser regression uses Lily's starting Foot and Protective Amulet. Next: Hired Muscle's Strength bonus and optional Strength-test reroll, using the existing scan; its combat integration remains separate.

## Hired Muscle: scoped Strength tests (3 October 2026)

The existing English front was visually verified: value 2, Ally, +1 Strength and an optional one-die reroll when resolving a Strength test. The existing `skill_bonus` and `test_reroll` nodes now accept Strength as well as Influence; no printed-text parsing or new protocol command is introduced. Hired Muscle uses `skill_test` applicability, bringing the current non-combat roster to eleven Assets; the other 29 remain guarded.

The holder's non-Item bonus combines with skill improvements, printed modifiers and applicable Urban Guide City auras before the minimum-one-die rule. It grants no bonus to another investigator or another skill. The free source uses the existing private `ActiveTest.usedRerollAssetIds` list, never the Foot's round-level list. Declining keeps the bonus; a new test can use Hired Muscle again. Clues and Lucky Rabbit's Foot remain independent sources, including rerolling the same die using different sources. Hired Muscle's Ally trait excludes it from Item discards.

Twelve engine cases cover combinations, four other skills, colleague exclusion, minimum dice, no-Clue payment, decline/new-test reset, generic Condition Reckoning Strength tests, Foot source order/restoration, illegal selections, Ally preservation and atomic nested-ambush rejection. A two-client room test uses General 10 Sea to verify actual content adaptation, improved Strength dice, owner authorization, private consumed-source restoration and continuation handoff. The existing browser reroll journeys exercise the same unchanged dialog, but are not a dedicated Hired Muscle browser test. Combat/ambush and Other World are not enabled.

The planned Bandages follow-up is implemented below.

## Bandages: ordinary encounter damage prevention (3 October 2026)

The generated English front was visually verified: value 1, Item, optional discard to prevent up to two Health loss for an investigator on the holder's space. `discard_prevent_health_loss` and `health_prevention` applicability bring the current ordinary encounter roster to twelve Assets; 28 others remain guarded. No text parsing or new client command is added.

The interpreter groups adjacent Health/Sanity losses into a server-only `damage_reaction` queue node before damage or defeat. This node is created internally and cannot be imported as printed content. An eligible living same-space holder receives a private `encounter_choice`, even if the injured investigator owns the encounter. The holder may decline, prevent one Health, or prevent two when available; accepting always discards the whole physical card. Sanity loss remains simultaneous and unmodified, and prevention cannot heal. Declining affects this loss only; a later distinct loss offers a new choice. Existing card/deck state stays paused until the reaction resolves.

Offering and accepting require a unique physical Asset identity across holdings, Reserve, deck, discard and defeated sheets. Acceptance rechecks holding, same space, live owner, card, encounter checkpoint and legal option. Discard uses the existing encounter-reason event and never refills the Reserve. The original investigator receives remaining damage and later instructions; lethal loss stops the queue and cycles the card once. A spent Bandages cannot also satisfy a later Item discard. The room retains the queue privately and uses the existing owner-only message and generic Encounter choice panel; no new public damage state or client-owned outcome is introduced.

Twenty-nine engine cases cover amount bounds, simultaneous Sanity, lethal prevention/decline/remaining damage, Doom-one awakening guard, colleague/privacy/restoration, exclusion of remote/defeated/eliminated holders, duplicate identities, vanished/moved sources, repeat losses, forged/replayed choices, Item-discard ordering and internal-node parsing. A two-client regression uses Azathoth Research 1 Wilderness's failed test to check private colleague authorization, pre-defeat restoration, physical discard, exact Clue retention, deck cycling and seat handoff.

Paid Health-cost sections with an eligible Bandages and nested ambushes with a same-space holder reject before rolling; costs and combat need different timing semantics. Combat/ambush, Mythos/Condition/other damage handlers and Other World integration are not enabled by this slice. Existing unsupported awakening still rejects atomically if remaining damage would trigger it.

The planned Whiskey follow-up is implemented below. Broader damage-source integration remains separate.

## Whiskey: ordinary encounter Sanity prevention (3 October 2026)

The existing English front was visually checked: value 1, Item, optional physical discard to prevent up to two Sanity loss for an investigator on the holder's space. `discard_prevent_sanity_loss` and `sanity_prevention` applicability bring the ordinary encounter roster to thirteen Assets; 27 others remain guarded.

`encounterDamagePreventions` identifies each living same-space physical source and its resource. The existing internal checkpoint offers only sources with remaining matching loss. New checkpoints record declines by Asset ID, so declining Bandages does not decline the same holder's Whiskey, or vice versa. Older checkpoints without that list still restore; their legacy declined-holder list remains respected. Decisions bind to the exact originally offered card even when declining, rejecting vanished, duplicated or moved sources instead of silently switching cards.

All eligible prevention decisions complete before remaining Health and Sanity losses apply simultaneously. Both cards can save simultaneous lethal damage; insufficient prevention retains the appropriate defeat causes and suppresses later rewards. Discarding removes the whole card even when preventing just one. The original encounter owner and physical Clue/deck identity stay unchanged while a colleague decides. No new client command, public queue or client-calculated outcome is introduced.

Twenty-seven additional engine cases cover Sanity amounts, optional partial prevention, both source orders, independent declines, same/different holders, privacy/restoration, lethal damage and Doom-one guards, duplicate/vanished sources, matching paid-cost guards and legacy checkpoints. A real two-client Azathoth Research 3 City failure verifies Whiskey's private colleague choice, state restoration, wrong-owner rejection, pre-defeat prevention, exact Clue retention, physical discard and single deck cycling. The existing Bandages room regression remains covered.

Paid Sanity costs with eligible Whiskey, paid Health costs with eligible Bandages and nested ambush reactions remain guarded. Combat, Mythos, Condition and Other World damage handlers are not integrated by this change. Next: Lucky Cigarette Case's optional once-per-round +1 to one test die result, verified from its existing scan; this is not a reroll. Broader damage timing remains separate.

Whiskey verification passed lint/typecheck/test/build with 432 engine, 53 server, 77 content and 18 protocol cases. All three existing browser journeys passed three repetitions each after correcting Charlie's fixture for a legal random starting Monster; these are shared UI regressions, not dedicated Whiskey browser coverage.

The scanned **Rally the People** Mythos Event now grants the Lead the first Ally in the private shuffled Asset deck, falling back to the discard pile if necessary and reshuffling the deck after a gain. The granted physical card leaves its source pile and becomes the Lead's possession; if no Ally remains in either pile, no card is gained. The remaining deck order is never synchronized to clients.

Run `pnpm assets:generate` to reproduce the 40 WebP fronts and shared back under `apps/web/public/cards/assets` from the committed sources.

## Lucky Cigarette Case: die-result modification (3 October 2026)

The existing English scan confirms value 2, Trinket and optional once-per-round +1 to one die result during a test. `round_test_die_increment` is a typed effect, bringing ordinary encounter applicability to fourteen Assets; 26 others remain guarded. Like the Foot, this is not an Item and cannot satisfy an Item-only discard.

`usedAssetDieModifierIds` tracks physical sources independently of the Foot's `usedAssetRerollIds` and test-local free rerolls. It survives new tests, JSON/room restoration and ownership changes, and resets on authorized next-round/setup transitions. Older states default to no recorded usage. Holding and physical conservation are checked before offering and on acceptance; duplicate encounter identities reject before the first roll. Owner-private `asset-increment:<physical ID>:<die index>` options share the existing runtime-validated decision command. The browser labels the action as a die modifier, not a reroll.

Accepting changes the current die value by exactly one, consumes no randomness or Clue, preserves the card and dice pool, recomputes successes, and emits `TEST_DIE_MODIFIED`. A subsequent Clue or Asset reroll replaces that modified value instead of retaining the +1. The holder chooses the source order. Keeping the result leaves unused modifier availability intact. Supported targets are existing die results 1–5; six is not offered, and this slice does not define above-six behavior.

Reference Guide page 10 supplies replacement-on-reroll semantics. The supplied Ultimate FAQ page 4's red FFG answer was visually verified: a changed five counts as six for rolled-six effects, so Fine Clothes counts that modified six as two Acquire Assets successes. The [official FFG FAQ](https://images-cdn.fantasyflightgames.com/filer_public/6d/33/6d33e762-f0e4-4f51-89b6-88e3354634cc/eh_errata__faq_2017-08-11.pdf), page 3, confirms fixed non-test rolls do not receive test modifications. Combat/ambush and Other World remain separate integrations.

Twenty-two engine cases cover all five skills, optional decline, Blessed/Cursed thresholds, no-Clue use, Fine Clothes, both Foot orders, later physical-Clue rerolls, exact Research collection, new tests/ownership/round reset, duplicate/lost/used sources, forged options, owner privacy and legacy state. A real two-client room regression combines Foot and Fine Clothes with modifier restoration, authorization, public usage synchronization and final purchase budget. Existing browser journeys are shared UI regressions, not a dedicated Cigarette Case scenario.

Next: Witch Doctor's same-space Rest choice between one additional Health recovery and discarding Cursed, using the existing verified scan. No new scans are required.

## Witch Doctor: same-space Rest choice (3 October 2026)

The supplied English scan confirms value 3, Ally and the optional additional Health-or-Cursed-discard effect. The typed node is `rest_health_or_discard_cursed`. Fifteen Assets now have explicit ordinary encounter applicability; Witch Doctor is Rest-only and therefore irrelevant to those encounters. Twenty-five other Assets remain guarded. Earlier counts above describe historical slices.

Ordinary Rest still applies capped Health/Sanity recovery and King James Bible, then offers Injury/Madness recovery rolls. `finishRest` next offers the resting investigator—not necessarily the Ally holder—an owner-private `rest_asset_choice`. They choose one additional Health, discard their held Cursed, or skip. The action completes exactly once after the bonus; no Clue, roll, Ally discard or round-limited source usage is consumed. A same-space colleague can later benefit on their own Rest.

The exact Ally must still be held, physically unique and on the resting investigator's space by a living investigator. Cursed discards return the exact server-private copy to its matching supply without flipping or revealing its reverse. Public events use only the front kind. Offered sources and Cursed conservation are checked again after restoration; invalid selections reject without changing canonical state. Monster-blocked Rest remains blocked.

Engine regressions cover both choices/decline, recovery caps, Bible interaction, holder/colleague eligibility, recovery-roll sequencing, turn handoff, repeat/ownership guards, conservation and JSON restoration. Two real room regressions cover private delivery, stable player ownership, restoration and both outcomes. The browser's existing choice dialog now renders the authoritative options with a “Rest bonus” heading; it does not compute outcomes.

The planned Puzzle Box Rest continuation is implemented below, with its Artifact-effect limitation explicit.

## Puzzle Box: scoped Rest test and Artifact draw (3 October 2026)

The supplied English front confirms value 3, Trinket, an optional Observation −2 test during Rest, and discarding this card to gain one Artifact on a pass. The typed node is `rest_test_gain_artifact`; no printed-text parsing occurs. Sixteen Assets now have ordinary encounter applicability; Puzzle Box's Rest-only effect is irrelevant there. Twenty-four other Assets remain guarded.

`pendingRest` is a private per-action checkpoint with the actor, remaining physical sources and optional testing source. After base recovery and Injury/Madness rolls, the owner can resolve Witch Doctor or Puzzle Box next in either order, skipping each independently. Removing Cursed before Puzzle Box changes its test threshold; using Puzzle Box first retains Cursed for that test. Each source is resolved at most once in this Rest, even after failure, and the final continuation charges exactly one action. Bible recovery is not repeated.

Puzzle Box uses the generic `rest_asset` skill-test continuation, printed modifier, improvements, applicable City aura, minimum-one-die rule, Blessed/Cursed thresholds, physical Clue rerolls and supported Asset die effects. Only its holder can test it; a colleague's Box is not an aura. Failure keeps the Box and Artifact order; decline consumes no dice. Passing moves the exact Box into Asset discard and takes the private deck's top Artifact without reshuffling, searching or exposing remaining order. A valid depleted Artifact supply grants nothing, while the printed Box discard still resolves.

**This is a guarded slice, not unrestricted random Artifact support.** T'tka Halot, Cultes des Goules and De Vermis Mysteriis gain/effects are currently executable. If the actual top card is one of the other 11 Artifacts, accepting the test returns `ARTIFACT_EFFECT_UNSUPPORTED` before rolling or discarding; it does not search for a supported card. The player can still choose “Skip Puzzle Box” and finish ordinary Rest. Missing/duplicated Artifact supply and unsupported carried test effects also reject atomically. Deck order and identities stay server-private; the error names no unrevealed card.

The engine preflights exact source holding/conservation, all remaining Rest sources and Artifact supply on acceptance and every resumed test command. `executeCommand` deep-copies the private Rest checkpoint, and public projections omit it. The room stores/restores the checkpoint privately; existing Rest bonus and test dialogs display server-authored options. Legacy Witch Doctor checkpoints without `pendingRest` still resolve.

Twenty-seven engine cases and two real room regressions cover success/failure/decline, thresholds and source order, Condition sequencing, City aura, Clue and Asset die effects, serialization, ownership, input-state purity, conservation, depleted supply, unsupported draws and single-action handoff.

Cultes des Goules now has its optional Lore/Sanity-for-two-physical-Clues action; De Vermis Mysteriis has its Lore/Sanity-for-one-chosen-skill-improvement action (with optional Lily double improvement). Either can be the true top Puzzle Box draw. Engine regressions verify each exact transfer without filtering or disturbing remaining order. See `base-game-token-encounters-and-artifacts.md` for payment, conservation and test scope. The planned carried-Asset integration is now implemented below. No new scans are required; the broader Artifact family, combat/Other World and full Task 1 remain incomplete.

Latest Puzzle Box verification passed lint/typecheck/test/build with 506 engine, 58 server, 77 content and 18 protocol cases (659 total), plus all three existing browser journeys. The 27 engine and two room cases cover Puzzle Box specifically; browser coverage remains shared-dialog regression coverage.

## Assets during Artifact Lore actions (3 October 2026)

T'tka Halot, Cultes des Goules and De Vermis Mysteriis now allow the existing sixteen explicitly supported non-combat Assets, rather than rejecting every carried Asset. The applicability roster and content status have not expanded: missing/unsupported metadata, unknown cards and unimplemented passive Artifacts remain guarded. Empty effect arrays alone never authorize a card.

`validateArtifactTestAssets` checks physical held Asset and eligible local City aura sources across holdings, Reserve, deck, discard and defeated sheets. `validateTomeAction` now applies equally to all three original Artifact sources before rolling, on restored test decisions and on payment/target acceptance. A duplicate source rejects before randomness or cost. A selected vanished/used reroll or modifier is rejected by the existing shared test handlers.

Urban Guide contributes one additional die on a living holder's City space, combining with improvements. Lucky Rabbit's Foot and Lucky Cigarette Case use the generic owner-private source choices and their separate round usage lists. Clue rerolls remain separate and return their exact tokens to discard; rerolling a modified die replaces the old result. Colleagues' Foot/Case effects are not auras. Personal Assistant/Hired Muscle apply only to Influence/Strength, Manuscripts only to Spell effects, and combat/Rest/Acquire-only effects do not change ordinary Lore.

The printed 1 Sanity is a **payment**, not preventable ordinary damage: held or local Whiskey cannot reduce it and is not offered/discarded. Bandages, Bible, Witch Doctor and Puzzle Box likewise do not fire from an Artifact action. These distinctions do not enable paid-cost sections in the separate encounter interpreter.

Thirty-six new pure engine cases and two real room cases verify the sixteen-card roster, three Tomes, dice/aura scope, physical-Clue/free-source order, replacement after modification, round persistence/reset, duplicate/lost/unsupported sources, owner authorization, private restoration and cost preservation. Root lint/typecheck/test/build passed with 599 engine, 64 server, 77 content and 18 protocol cases (758 total); all three existing browser journeys passed. Browser coverage is shared-test-dialog regression coverage, not a dedicated Artifact journey.

Only 3/14 Artifact gain/effects remain supported. Next: begin the Other World encounter foundation from the existing scans, starting with card 1's typed Initial/Pass/Fail transcription and a guarded Gate-bound lifecycle. No additional scans are needed for that next step.
