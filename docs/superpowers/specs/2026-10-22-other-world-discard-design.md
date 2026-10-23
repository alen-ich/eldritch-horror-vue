# Physical Other World draw and discard

## Intent and verified gap
Continue the user-authorized dependency sequence toward rules-correct authoritative encounters. The live shared continuation currently returns every resolved card to the private deck bottom. Reference Guide pages 3 and 5 require immediate replenishment of an empty deck from its faceup discard pile. Other World is the next complete slice: it already has a full physical ID catalog, guarded effects and Gate-bound continuation. Installed Colyseus0.18.5/Playwright1.63.0 remain unchanged.

## Scope and recommended architecture
Remove an Other World card from its private undrawn deck before resolving effects. Mark its existing private pending continuation with `cardRemovedFromDeck: true`. Publish only `otherWorldDiscardIds: string[]`, current revealed card and existing decisions. When drawing the last card, immediately shuffle previous discards, excluding the active card. On completion append that active card to the faceup discards. If both deck and prior discards were empty (a single-card fixture), replenish after that final discard. Preserve existing Gate ownership, original location, closure and possession guards.

Use a pure inventory validator shared by command preflight and room restoration: known unique IDs conserved across deck/discard/active card, current reveal matches active binding, flag is strictly true when present. A legacy pending card still on top is accepted only with an otherwise complete legacy deck and empty discards; migrate it once, after all preflight checks, before effects. Legacy full decks without a discard field remain valid. New setup initializes an empty discard list. Never reconstruct a lost order or search past unsupported tops.

## Alternatives
Recommended: isolate Other World first, retaining its strong full-catalog validation. Changing all encounter families together expands legacy migration and fixture scope without improving this slice's acceptance. Deferring shuffle until the next draw leaves the public discard zone incorrect while the deck is empty. Continuing bottom cycling violates the source rule. A new generic inventory framework or npm package is unnecessary.

## Authority, privacy, errors
No new network command, client-selected card, dice, reward or shuffle. Pure engine code has no framework/network dependencies. Pending queue/flag and undrawn order remain private; faceup discards are public. Validate before effects/random input; checkpoint deterministic randomness on failure/throw for direct draws and resumed Other World decisions. Malformed restored zones fail before room mutation. Full catalog absence is tolerated only when no Other World inventory/reveal/pending card exists; initialized rooms cannot strip their deck.

## Acceptance and tests
Draw removes actual top; unsupported tops and corrupt zones reject atomically. Multi-step owner-only decisions and serialized restoration retain active card and Gate binding. Finish discards rather than cycles, including lethal/end-game paths. Last-card recycle excludes active card, conserves every ID, validates shuffle output and rolls back failed deterministic input. Legacy top-bound continuations migrate once. Two clients see discards without private order/flag; replacement clears the client list. Existing Other World card trees and multiplayer tests remain green after replacing obsolete bottom-cycle expectations. Root lint/typecheck/test/build and all three Playwright configurations pass.

## Exclusions and approval
No new card effects, investigator/possession support, readiness promotion, Location/Research discard change or Expedition command. Those families remain documented follow-ups. Preserve unrelated work; current branch; no commits/push/merge/deploy. Self-reviewed and self-approved under the user's explicit delegation: focused interfaces, legacy rule and limits are explicit; no unresolved requirement.
