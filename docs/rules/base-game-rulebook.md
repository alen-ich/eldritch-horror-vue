# Base-game rulebook implementation

The engine rules are derived from the user-supplied `eh01_rulebook.pdf` (16 pages, SHA-256 `8147dc576209e4f23b9b376bb667656e622dfb8c93837d5b98d0066f96262883`). The PDF itself remains outside the repository.

The rulebook says the separate Reference Guide is definitive for exceptions and conflicts. That guide has now been supplied and indexed in `docs/rules/base-game-reference-guide.md`. Component text still has higher precedence, so unavailable or OCR-only component text must not be guessed.

## Implemented foundation

- A round is modeled as Action, Encounter, then Mythos phases.
- The Lead Investigator acts first and remains the first investigator for the following phase.
- Each investigator receives up to two actions and cannot repeat the same action in one round.
- Travel moves one adjacent space. Additional movement requires one matching train or ship ticket per path; uncharted paths cannot consume tickets.
- Rest recovers one Health and one Sanity without exceeding maximums and is prohibited on a Monster space.
- Prepare for Travel requires a City with a connected path of the requested type and enforces the two-ticket limit.
- Ending actions advances to the next investigator; finishing the final investigator advances the game to the Encounter phase.
- Skill tests use printed skill, improvements, modifiers, the highest applicable item bonus, other bonuses, and a minimum result of one die; 5-6 count as successes.
- An investigator may spend Clues one at a time to reroll individual test dice. The active test and reroll choice survive reconnection.
- Acquire Assets uses this authoritative Influence-test lifecycle, then resolves Reserve purchases and refill atomically.
- Health and Sanity recovery is capped at the investigator's maximum; shared resource rules also cap loss at zero and report when a resource is newly depleted. Defeat handling remains a separate pending lifecycle.
- Action choices and resources are synchronized through authoritative Colyseus room state.

## Remaining rules layers

1. Complete Action phase: Trade, Bank Loan/Debt, and component/local actions.
2. Tests and resources: authoritative loss events and defeat interruption, plus Blessed/Cursed thresholds after Conditions are verified.
3. Encounter phase: Monster ordering, combat, location decks, token encounters and complex encounters.
4. Mythos phase: ordered icons, Omen/Doom, reckoning, Gates, surges, Monsters, Clues, Rumors and events.
5. Setup: Ancient One selection, Mythos deck construction, randomized token pools, Reserve and starting possessions.
6. Defeat, devouring, replacement investigators, awakening, Mysteries, victory and loss.
7. Structured card effects and Ancient One-specific exceptions, after the Reference Guide and verified card text are available.

All random draws and dice rolls must enter the pure engine through injected deterministic inputs. Deck order and unrevealed card backs remain server-private.
