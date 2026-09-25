# Base card catalog

The project includes the user-supplied 189-card catalog and paired front/back scans.

- Structured data: `packages/content/src/data/cards.json`
- Runtime schema and helpers: `packages/content/src/cards.ts`
- Browser assets: `apps/web/public/cards/{front,back}`

The catalog covers eight families: expedition, three regional location decks, Mythos, Other World, research, and special encounters. Validation checks the declared count, unique sequential IDs, supported families, source coordinates, and matching front/back paths.

The source labels 78 records as requiring manual OCR review. The application preserves this flag and warns users to rely on the scan for authoritative card text. OCR descriptions are not executable rules and are not used by the engine.

The lobby card archive is a reference browser with search, family filters, pagination, and front/back viewing. It does not represent deck order, draws, hands, or any other authoritative game state. Future deck implementation must keep randomized order and unrevealed cards server-side.
