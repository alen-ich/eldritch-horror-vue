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

Game start now shuffles those nine Gate IDs into a server-private stack and opens the player-count Reference card's starting number of Gates, resolving each Gate's Monster spawn in the same authoritative setup transition. The client receives neither stack order nor unspawned Gate faces. An unsupported drawn Monster spawn effect rejects setup without publishing a partial board.

The engine and room preserve public active and discarded Gate IDs separately from the private remaining stack. The internal Gate-opening transition draws the top token, places it at its printed city, and resolves one Monster spawn atomically. If no normal Monster token remains in the finite cup, the Gate still opens. An unsupported Monster effect leaves both pools and public state unchanged. Internal Mythos Monster Surge and yellow Spawn Gates steps now invoke this transition. The scanned **Dimensional Instability** Event discards every Gate matching the current Omen into the public faceup discard pile and advances Doom once per discarded Gate. When the private stack becomes empty, discarded Gates return to a shuffled private stack; the event and opening transitions preserve that lifecycle. The narrow Other World card 2 closure path below is now supported; other closure effects and the no-Gates-left Doom fallback remain pending.

Other World card 2's successful Initial test closes exactly the originally encountered on-space Gate, before its follow-up Observation test. The engine moves that token from active Gates to discards (or back into the private stack if empty), emitting `GATE_CLOSED` once. It does not change Doom, remove Monsters, redraw/open a Gate, or award generic closure progress. Card conservation validates every active/discarded/stack identity against the physical catalog. The private encounter binding records the original Gate, space, card and whether closure already happened, so a restored follow-up remains valid after the token leaves the board. Akachi's movement and Yog-Sothoth's Spell/Mystery closure interactions remain guarded. See `base-game-token-encounters-and-artifacts.md` for the full slice and limitations.
