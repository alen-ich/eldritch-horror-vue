# Physical Expedition draw, discard and recycling foundation

## Goal and rules correction
Provide correct physical card accounting before enabling verified Expedition effects. Source verification found an important dependency: Reference Guide printed pages 5–6 specify faceup discard piles, immediate recycling when a deck is empty, and token relocation whenever its top changes. The earlier in-chat suggestion to cycle a resolved Expedition to the bottom was wrong. The existing generic encounter interpreter currently cycles cards; this iteration must not copy that simplification. Its other encounter families need a separate correction, explicitly tracked below.

## Scope and architecture
Extend the Expedition setup foundation with internal pure-engine draw and discard transitions, without a network command or live effect execution. START_GAME initializes an empty public `expeditionDiscardIds` list. A draw removes the actual private top, stores a server-private `expeditionDraw` binding {cardId,playerId,locationId}, reveals only that card through existing currentLocationEncounterCardId, and updates the token to the next private top's back location immediately. If removing the last card empties the deck, immediately shuffle the prior discard pile and clear that public pile before deriving the new token. The drawn card remains outside that shuffle.

Finishing the physical draw moves exactly that bound card into the public discard list, clears the private binding/current reveal and sets lastLocationEncounterCardId. It neither executes effects nor advances encounter turns. No resolved card returns to the bottom. Private deck + public discard + at most one bound draw must contain every one of the 18 canonical cards exactly once. Initial shuffle and recycle use injected context; failed operations roll back available deterministic checkpoints and do not mutate input/version. Each accepted internal transition increments version once; future command integration must compose/rebase transitions appropriately.

## Ownership, restoration and public boundaries
Internal draw requires the active living Encounter investigator on the token's space, no on-space Monsters, no Detained Condition and no pending test/decision/defeat/other encounter/draw. Reject stale bindings, duplicate/foreign/missing cards and already-active reveals. Discard requires the bound owner and matching revealed card; it may finish after defeat or game end so the physical card is not stranded. The private binding records the card's origin independently of the token's newly advanced location.

Server Schema adds only the public discard list; existing privateState carries the binding. Restoration validates all three zones and top-marker agreement before any mutation, and still rejects stripping an initialized deck. Legacy snapshots with an intact full deck but no discard list are treated as an empty list without a reshuffle; absent-both legacy snapshots remain unchanged. The client exposes a readonly list reset on attachment; no draw/finish button is added. Existing public current/last card rendering can show an internally drawn/resolved front.

## Alternatives and exclusions
Keeping all 18 cards in the private deck while also tracking a drawn card duplicates physical identity. Cycling to the bottom contradicts discard/recycle rules. Exposing a public draw command before effect support would permit skipping encounter resolution. Therefore this complete internal inventory dependency precedes the guarded executable slice.

No Expedition effect handler, player command, generic Artifact reward, spawn/combat continuation, full readiness claim or changes to other encounter families in this iteration. Known follow-up: replace generic Location/Research/Other World bottom cycling with rules-correct discard/recycle; tracked as an existing gap, not certified by this work.

## Acceptance and tests
Draw/discard conserves 18 identities and changes public token when top changes; current card reveals only itself, never remaining order. Repeat drawing/discarding all18 demonstrates last-card recycle excludes the in-flight card, clears the prior public pile and preserves exact deterministic order. Wrong owner/phase/space/pending/Monster/Detained, repeated draw/discard, corrupted zones/reveal/binding and exhausted shuffle input reject atomically. JSON/server restoration and two-client projection preserve all zones with private order/binding hidden. Client replacement clears the discard list. Existing browser suites stay green.

## Approval
Spec self-review: explicit staged internal API, correct accounting and legacy behavior; no unresolved rules. Self-approved under user delegation, inline current branch, preserve all work, no commits or publication.
