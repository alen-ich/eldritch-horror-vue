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
- source-sheet row and column;
- generated browser asset path;
- scan-verification and executable-effect status.

Validation requires exactly 18 green, 21 yellow, and 12 blue cards, unique IDs and titles, and Rumor classification for every blue card. Tests also require all 51 generated fronts to exist.

## Authority boundary

The card roster, titles, colors, and visible card kinds are verified from the English scans. The detailed icon sequence and printed effect for each card have not yet been transcribed into executable content, so the `mythos_cards` readiness family remains `needs_review`.

The engine must not execute OCR or display text. A later rules slice will model the shared Mythos resolution sequence first, then encode repeated effect patterns and Rumor state with deterministic tests.
