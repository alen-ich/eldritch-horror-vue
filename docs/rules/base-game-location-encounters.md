# Base-game location encounter scans

The supplied English sheets contain all 36 base-game location encounter fronts and four shared backs. Card numbers and three printed sections were visually checked against the generated crops.

| Deck | Base-game count | Imported | Printed sections | Status |
| --- | ---: | ---: | --- | --- |
| General | 12 | 12 | City, Wilderness, Sea | Complete artwork/catalog |
| America | 8 | 8 | Arkham, San Francisco, Buenos Aires | Complete artwork/catalog |
| Europe | 8 | 8 | London, Rome, Istanbul | Complete artwork/catalog |
| Asia/Australia | 8 | 8 | Shanghai, Tokyo, Sydney | Complete artwork/catalog |

`packages/content/src/location-encounters.ts` owns stable IDs, deck membership, card numbers, section labels, source-sheet provenance, and public face/back URLs. `pnpm encounters:generate` crops the supplied contact sheets into 36 individual WebP fronts and four shared backs; its explicit row/column mapping preserves the Asia/Australia 1-3, 6-8 and 4-5 source-sheet ordering.

The 36 cards now also have scan-checked mechanical transcriptions in `packages/content/src/location-encounter-rules.ts`: 108 location sections with tests and modifiers, ordered outcomes, optional costs, and pass/fail choices. The image catalog retains the family-level `not_executable` status. At setup, the server shuffles each of the four physical location decks separately and retains its order privately. The data model deliberately records effects that lack engine support (Conditions, Spells, Artifacts, target selection, item discard, and movement), rather than silently dropping them. The other encounter families (Research, Other World, Expedition, and Special) are not included in this import.

The pure engine now identifies legal General/Regional location decks by space and blocks them while a Monster remains on that space. An internal post-encounter continuation advances investigators clockwise from Lead, skips defeated seats, and enters Mythos only after the last eligible investigator. This continuation is not a client skip command; it must be called only after an actual encounter has been resolved.

An authenticated `RESOLVE_LOCATION_ENCOUNTER` command now resolves only a top card whose printed section is a choice-free skill test or a simple Clue award. It rolls with authoritative skills, improvements, and Blessed/Cursed thresholds, takes physical Clues from the private supply, cycles the resolved card to the bottom of its deck, and advances the encounter turn. Tests with held Clues now pause for the existing owner-only, reconnectable one-Clue-per-die reroll decision; the card remains on top until the owner accepts a final result. Carried Assets remain blocked until possession bonuses are modeled. Unsupported text, mandatory Monsters, or an invalid deck leave the card and state untouched. This is a narrow playable slice, not completion of the 108 sections; most cards will still stop here.

The browser shows a small Encounter control for the active investigator and the revealed card during a pending test or the last successfully resolved card afterward. Unrevealed deck order stays private. Unsupported-card errors are visible in the game view.
