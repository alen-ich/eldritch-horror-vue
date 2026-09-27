# Base-game Gate tokens

The supplied archive contains 15 Gate faces. Nine belong to the base game and six—Amazon, Antarctica, Heart of Africa, Himalayas, Pyramids, and Tunguska—are expansion tokens excluded from the application.

## Verified base pool

| Gate | Omen symbol |
| --- | --- |
| Arkham | Eclipse |
| Buenos Aires | Constellation |
| Istanbul | Comet |
| London | Constellation |
| Rome | Eclipse |
| San Francisco | Comet |
| Shanghai | Eclipse |
| Sydney | Eclipse |
| Tokyo | Constellation |

`packages/content/src/gates.ts` owns the nine-token pool. Validation requires complete unique IDs, unique board locations, legal Omen symbols, and generated face/back assets. Gate order and draws remain server-private when setup and Mythos spawning are connected to this content.
