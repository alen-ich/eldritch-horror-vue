# Base-game Asset cards

The supplied archive contains exactly 40 individually named English Asset fronts, matching the base-game component count. No expansion cards were found.

`packages/content/src/assets.ts` provides stable IDs, printed English titles, values, normalized traits, timing categories, effect text, source-image references, and generated front/back URLs for the complete roster. Validation requires exactly 40 unique IDs and titles, legal values and categories, nonempty effect text, and matching source and browser image names. Tests confirm the starting Asset names printed on investigator sheets are represented in the catalog.

The supplied JSON is retained as source data under `source-assets/assets`, and `pnpm assets:data` deterministically generates the normalized TypeScript definitions. The complete shared Asset back is supplied, generated, and required by content validation.

The Asset family remains `needs_review` rather than `verified` because:

- the transcribed effects still need comprehensive card-by-card scan verification;
- Asset effects are not yet executable in the rules engine;
- investigator starting possessions are not yet converted from display strings to stable component references.

Run `pnpm assets:generate` to reproduce the 40 WebP fronts and shared back under `apps/web/public/cards/assets` from the committed sources.
