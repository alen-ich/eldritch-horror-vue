# Base-game Asset cards

The supplied archive contains exactly 40 individually named English Asset fronts, matching the base-game component count. No expansion cards were found.

`packages/content/src/assets.ts` currently provides stable IDs, printed English titles, and generated front-image URLs for the complete roster. Validation requires exactly 40 unique IDs and titles, and tests confirm the starting Asset names printed on investigator sheets are represented in the catalog.

The complete shared Asset back is also supplied, generated, and required by content validation. The Asset family remains `needs_review` rather than `verified` because:

- values, traits, bonuses, actions, and other printed effects have not yet been transcribed and verified;
- Asset effects are not executable in the rules engine;
- investigator starting possessions are not yet converted from display strings to stable component references.

Run `pnpm assets:generate` to reproduce the 40 WebP fronts and shared back under `apps/web/public/cards/assets` from the committed sources.
