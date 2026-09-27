# Ultimate FAQ 2.0 review

The user supplied `Ultimate_FAQ_2.0_Eldritch_Horror_-_3_Jan_2024.pdf` (26 pages, SHA-256 `ef61dd44f9099b174e265764126e2c2716aff255a4cb8f0960524e17e0f5d968`). The PDF remains outside the repository.

This is a community-edited compilation dated January 3, 2024. It combines base-game and expansion errata, official FFG staff answers, community-collected answers, duplicated reference material, and optional variant Reference cards. It is useful regression evidence, but the entire document must not be treated as uniformly authoritative.

## Authority policy

1. **Official errata reproduced by the compilation:** apply after confirming the affected base-game component or rule. These entries may correct the Reference Guide or component text.
2. **Red FFG staff answers:** treat as authoritative FAQ clarifications and add regression cases when the affected system is implemented.
3. **Black community or unattributed answers:** retain as review evidence only. Do not implement them without confirmation from an official source or the underlying component text.

The Reference Guide's golden-rule precedence still applies. Component text has priority over the Reference Guide, and confirmed errata supersedes the text it explicitly corrects. The compilation's own claim that all its rulings take precedence does not elevate community material to official authority.

## Base-game implementation matrix

| FAQ area | Pages | Engineering requirement | Planned milestone |
| --- | --- | --- | --- |
| Reference Guide errata | 1 | Correct duplicate-Condition handling, highest single skill bonus, Rumor cleanup, and empty-Mythos-deck loss timing | 3, 7, 9, 10 |
| Base Asset and Ancient One errata | 1 | Use corrected executable effects only after the corresponding components have verified stable IDs | 8, 10 |
| Test construction and rerolls | 3-4 | Declare additional dice before rolling; apply minimum one die only after the full pool is calculated; fixed rolls are not tests; one reroll effect cannot reroll the same die twice; mandatory passive bonuses apply | 3 |
| Trigger and choice semantics | 3-4 | Resolve a trigger once per triggering event, resolve triggered effects after the event, preserve `may`/`or`/`unless` choices, and distinguish prevention, replacement, loss, and costs | 1, 3, 10 |
| Health and Sanity maximums | 3-4 | A reduced maximum clamps current value only when current exceeds the new maximum | 3 |
| Investigator and starting-possession clarifications | 4-9 | Model replacement starting possessions, active-investigator ownership, additional actions, and investigator-specific exceptions with typed handlers | 2, 4, 10 |
| Ancient Ones and Mysteries | 9-11 | Add terminal timing and Ancient One-specific regressions only after sheets and Mystery cards are supplied | 8-10 |
| Assets, Artifacts, Spells, Conditions | 11-19 | Verify the exact component and expansion before implementing any cited exception | 10 |
| Monsters, encounters, Mythos, Doom, and Omen | 19-23 | Add ordering, spawn, defeat, movement, and Rumor regression cases to the corresponding engine slices | 5-9 |
| Expansion sideboards and local paths | 23-24 | Out of base-game scope | Excluded |
| Investigator ability summary | 25 | Cross-check against the official Reference Guide page 13 and investigator sheets | 10 |
| Variant Reference cards | 26 | Optional variants, not canonical base-game player-count setup data | Excluded from base setup |

## Immediate design constraints

- Pending decisions must preserve optional choices even if the selected consequence is later prevented.
- Triggered effects need stable ordering and once-per-trigger tracking; once-per-round tracking alone is insufficient.
- The test engine must distinguish tests from fixed dice rolls and track individual dice so reroll eligibility survives multiple effects.
- Health/Sanity costs, losses, prevention, and replacement effects require distinct typed operations.
- Starting possessions cannot remain display strings; replacement instructions require traits, deck searches, exclusions, and stable component IDs.
- Terminal evaluation after a failed Mythos draw must check whether investigators have already won before recording a loss.

Pages 1, 3, 9, 24, and 26 were visually inspected after rendering. Text extraction was used only to index questions and identify candidate regression cases. No free-form FAQ text will be executed at runtime.
