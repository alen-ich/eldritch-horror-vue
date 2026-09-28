# Base-game Reference Guide

The authoritative rules source is the user-supplied `eh01_reference_guide1.pdf` (16 pages, SHA-256 `a2110a94ff92be7f4d95e8334d9f48e6169f00fca06c074d6dbb30c006aacd42`). The PDF remains outside the repository.

The guide's golden rules establish this precedence:

1. Component text overrides the Reference Guide and rulebook.
2. The Reference Guide overrides the rulebook.
3. An effect using `cannot` is absolute.

Confirmed errata and official FAQ answers can correct or clarify these rules. The provenance policy and candidate regressions from the supplied 2024 community compilation are recorded in `docs/rules/base-game-faq.md`.

This means component-specific behavior cannot be declared complete until the corresponding card, sheet, or token text is verified, even when its general rule is documented here.

## Implementation matrix

| Rule family | Reference Guide pages | Current implementation |
| --- | --- | --- |
| Actions, Acquire Assets, Bank Loan | 2 | Travel, Rest, Prepare for Travel, ending actions, and Acquire Assets implemented; Debt, Trade, and component/local actions remain |
| Clues and rerolls | 3, 10 | Individual sequential Clue rerolls are authoritative and reconnectable for tests; non-test fixed rolls remain distinct |
| Combat and Monster damage | 3 | Not implemented |
| Complex encounters | 3 | Decision infrastructure implemented; encounter resolution remains |
| Component actions and limitations | 3 | Once-per-action tracking foundation exists; component identity and availability rules remain |
| Conditions, conflicts, defeat, delay, devouring | 4 | Not implemented |
| Doom, Epic Monsters, expeditions | 5 | Not implemented |
| Encounters, possessions, Gates | 6-7 | Not implemented |
| Health, Sanity, hidden information, skill improvements | 7 | Maximums, state boundaries, skills, and improvements implemented; generic loss/recovery and defeat remain |
| Lead Investigator, local actions, Monsters, surges, Mysteries, Mythos | 8 | Lead Investigator and turn order partially implemented; remaining systems absent |
| Omen, paths, Prepare for Travel, random spaces, Reckoning | 9 | Path types and Prepare for Travel implemented; remaining systems absent |
| Reference cards, Reserve, Research, Rumors | 10 | Not implemented; player-count Reference card data is still missing |
| Spawning, Spells, tests, ties, train/ship rules | 11 | Generic tests and route types implemented; spawning, Spells, and tie handling remain |
| Trade, traits, Travel, victory/loss, FAQ clarifications | 12 | Travel implemented; remaining systems absent |
| Investigator ability clarifications | 13 | Display text exists; executable abilities remain |
| Optional difficulty and solo rules | 14 | Explicitly deferred until the base game is complete |

## Engineering consequences

- Simultaneous-effect conflicts require an authoritative active-investigator or Lead Investigator choice rather than client-side ordering.
- Hidden Condition backs, double-sided cards, random decks, and token pools must remain server-side.
- Component limits must be handled explicitly: unavailable components cannot be gained or spawned, and empty-pool fallbacks differ by component type.
- Clue rerolls replace the selected die result and can occur repeatedly when the investigator can pay; fixed dice rolls that are not tests do not accept test rerolls.
- A component action is limited per component per round, even if ownership changes, while local actions have different per-investigator limits.
- Defeat can interrupt an action or encounter and must terminate the current resolution safely.
- Mythos and Reckoning ordering must be modeled explicitly; it cannot be inferred from UI order.

Pages 1, 3, 8, 15, and 16 were visually inspected after rendering. Text extraction was used for indexing and discovery, not as executable card or component content.
