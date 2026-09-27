# Base-game Icon Reference cards

The supplied English sheet contains all eight base-game player-count faces plus five expansion variants. Only the base-game faces are registered and generated for the application.

## Verified values

| Investigators | Spawn Gates | Spawn Clues | Monster Surge |
| ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 1 |
| 2 | 1 | 1 | 1 |
| 3 | 1 | 2 | 2 |
| 4 | 1 | 2 | 2 |
| 5 | 2 | 3 | 2 |
| 6 | 2 | 3 | 2 |
| 7 | 2 | 4 | 3 |
| 8 | 2 | 4 | 3 |

`packages/content/src/reference-cards.ts` owns this scan-backed table and validates complete, unique coverage for 1-8 investigators. The values are now available to deterministic setup and Mythos icon resolution, but those engine transitions remain pending.
