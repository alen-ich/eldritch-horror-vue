# Base-game location encounter scans

The supplied English sheets contain all 36 base-game location encounter fronts and four shared backs. Card numbers and three printed sections were visually checked against the generated crops.

| Deck | Base-game count | Imported | Printed sections | Status |
| --- | ---: | ---: | --- | --- |
| General | 12 | 12 | City, Wilderness, Sea | Complete artwork/catalog |
| America | 8 | 8 | Arkham, San Francisco, Buenos Aires | Complete artwork/catalog |
| Europe | 8 | 8 | London, Rome, Istanbul | Complete artwork/catalog |
| Asia/Australia | 8 | 8 | Shanghai, Tokyo, Sydney | Complete artwork/catalog |

`packages/content/src/location-encounters.ts` owns stable IDs, deck membership, card numbers, section labels, source-sheet provenance, and public face/back URLs. `pnpm encounters:generate` crops the supplied contact sheets into 36 individual WebP fronts and four shared backs; its explicit row/column mapping preserves the Asia/Australia 1-3, 6-8 and 4-5 source-sheet ordering.

These are scan-verified images, **not executable encounter effects**. The catalog marks every effect `not_executable`; it must not be shuffled into a playable encounter deck or offered as a client action yet. Card-by-card text verification, typed branches, hidden deck order, and phase resolution are separate work. The other encounter families (Research, Other World, Expedition, and Special) are not included in this import.
