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

Game start now shuffles those nine Gate IDs into a server-private stack using deterministic setup input. No Gate is placed yet: a Gate spawn must also resolve its Monster spawn effect, so placement remains blocked until that authoritative transition is implemented. The client receives neither stack order nor unspawned Gate faces.

The engine and room preserve public active Gate IDs separately from the private remaining stack. The internal Gate-opening transition draws the top token, places it at its printed city, and resolves one Monster spawn atomically. If no normal Monster token remains in the finite cup, the Gate still opens. An unsupported Monster effect leaves both pools and public state unchanged. Internal Mythos Monster Surge and yellow Spawn Gates steps now invoke this transition; the live room phase and starting setup do not yet. Gate closure and returning a Gate to the stack remain pending.
