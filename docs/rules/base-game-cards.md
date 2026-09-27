# Base card catalog

The project includes the user-supplied 189-card catalog and paired front/back scans.

- Canonical structured source: `packages/content/src/data/cards.json`
- Runtime schema and full-data entrypoint: `packages/content/src/cards.ts` via `@eldritch/content/cards`
- Lightweight shared types: `packages/content/src/card-types.ts` via `@eldritch/content/card-types`
- Browser assets: `apps/web/public/cards/{front,back}`

The catalog covers nine families: expedition, three regional location decks, Mysteries, Mythos, Other World, research, and special encounters. Validation checks the declared count, unique sequential IDs, supported families, source coordinates, and matching front/back paths.

The 16 Mystery fronts are classified separately and linked to the authoritative structured roster in `packages/content/src/mysteries.ts`. They were visually checked against the scans; OCR remains reference-only even for these cards.

The source labels 78 records as requiring manual OCR review. The application preserves this flag and warns users to rely on the scan for authoritative card text. OCR descriptions are not executable rules and are not used by the engine.

Run `pnpm cards:generate` after changing the canonical JSON or scans. The deterministic generator validates exact front/back coverage and produces a compact browser index, one detail JSON per card, and 320-pixel WebP thumbnails. Generated artifacts live under `apps/web/public/cards/{data,thumbnails}` and should not be edited manually.

The lobby card archive is opened explicitly and then fetches the compact index. It loads only visible thumbnails and fetches one detail record and full scan when a card is opened. The full canonical JSON is therefore absent from the client JavaScript bundle. Static card responses receive bounded cache headers through Nuxt route rules.

The archive does not represent deck order, draws, hands, or any other authoritative game state. Future deck implementation must keep randomized order and unrevealed cards server-side.
