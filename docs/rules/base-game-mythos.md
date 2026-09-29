# Base-game Mythos reference

## English scan coverage

Four supplied source sheets contain all 51 base-game Mythos card fronts:

- 18 green cards;
- 21 yellow cards;
- 12 blue Rumor cards.

The source sheets live under `source-assets/mythos`. Run `pnpm mythos:generate` to reproduce the individual WebP fronts under `apps/web/public/cards/mythos`. The generator uses the verified 6-by-3, 3-by-1, and 6-by-2 source grids and assigns stable color-sequence IDs.

## Structured content

`packages/content/src/mythos.ts` records each card's:

- stable ID and English title;
- color and printed card kind;
- verified left-to-right icon sequence, including Rumor spaces and Eldritch-token counts;
- source-sheet row and column;
- generated browser asset path;
- scan-verification and executable-effect status.

Validation requires exactly 18 green, 21 yellow, and 12 blue cards, unique IDs and titles, and Rumor classification for every blue card. Tests also require all 51 generated fronts to exist.

## Authority boundary

The card roster, titles, colors, visible card kinds, and printed icon sequences are verified from the English scans. The rulebook's Mythos-phase icon key was visually checked against the scanned cards. Green cards share Advance Omen, Monster Surge, Spawn Clues; yellow cards share Advance Omen, Resolve Reckoning, Spawn Gates; blue cards begin with Spawn Clues, then their printed Rumor/Eldritch placement icons. The printed text effect for each card has not yet been transcribed into executable content, so the `mythos_cards` readiness family remains `needs_review`.

The engine must not execute OCR or display text. A later rules slice will model the shared Mythos resolution sequence first, then encode repeated effect patterns and Rumor state with deterministic tests.

The pure engine now has an internal draw transition: it reveals the top card from the server-private staged deck, exposes only that card ID, prevents drawing again until the revealed card is resolved, and ends the game if a required draw finds the initialized deck empty. An uninitialized deck or unknown card ID fails without mutation. The revealed card is represented in room state, but no client command invokes this transition yet because icon execution and card effects remain unimplemented. The end-of-Mythos replacement window cannot open while a revealed card is unresolved.

The pure Omen kernel now models the board's four printed spaces in clockwise order (comet, constellation, eclipse, constellation). It counts Doom from active Gates separately for every space entered, including both constellation spaces and wraps around the track. This is not yet a live Mythos transition: active Gate placement, Ancient One overrides, awakening, and subsequent icons must be connected before a card can progress.

An internal Mythos-only Omen transition now reads the public active Gates, moves one space clockwise, and reduces Doom for matching symbols. Azathoth's Eldritch tokens on green also advance Doom, with its immediate loss at zero. Awakening for the other three Ancient Ones remains explicitly unsupported, so their Doom cannot silently cross zero. This transition is not yet invoked from a revealed Mythos card.
