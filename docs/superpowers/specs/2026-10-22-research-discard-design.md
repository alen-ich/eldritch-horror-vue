# Physical Research discard and recycling

## Goal and evidence
Replace Research bottom cycling with the physical lifecycle already recorded from Reference Guide pages 5–6 in the Expedition discard specification: drawn cards leave the deck, completed cards enter a faceup discard, and an emptied deck immediately shuffles previous discards. Current Research completion in continueLocationEncounter still appends the card to the private bottom; Other World already implements separate zones. Production supplies all eight selected physical cards independently of supported effects.

## Architecture and boundaries
Add optional public researchDiscardIds:string[] to engine state, room JSON Schema field and readonly client projection. The selected Ancient One has one Research deck per game, so no per-deck public map is needed. Existing private pendingLocationEncounter retains cardId and cardRemovedFromDeck:true. Remove the top on a clone before effects or decisions; shuffle prior discards immediately when empty, excluding the in-flight card. Completion, including defeat/game-end cleanup, appends exactly once; singleton legacy fixtures recycle on completion when no prior discard exists. Production conserves eight canonical identities across undrawn, discarded and removed active card.

Keep legacy full decks without a discard field, and top-bound saved continuations; migrate a legacy pending card once on its cloned transition. Legacy partial rule fixtures without researchEncounterSetup retain partial inventory compatibility, but all participating IDs must be dense, unique, nonempty and selected-deck IDs. Configured catalogs never fall back to partial inventories. Reject false removed flags, duplicated/foreign/missing identities, orphan reveal, incompatible owner/deck/phase, invalid shuffle output and stripped initialized decks before canonical room mutation. Do not repair corruption silently. Errors contain no card IDs.

Server owns outcomes, private order and pending binding; clients see only revealed cards and faceup discards. Copy public arrays to prevent aliasing. Restore JSON snapshots and reconnections without reshuffling. Existing Research RNG transaction must roll back dice, IDs, token selection and shuffle input on any rejected draw/resumed decision. Unsupported actual top remains private and untouched.

## Alternatives and scope
Recommended: Research-specific physical helpers integrated with existing interpreter and transaction. A generic all-encounter lifecycle rewrite also affects Location and is larger than needed. Leaving cards in the deck while additionally recording a draw duplicates inventory; bottom cycling contradicts the recorded rule. No new package, wire command, printed effect, marker-origin binding or Location migration. No whole-family readiness promotion.

## Acceptance and tests
Normal draw/completion, owner decision plus JSON resume, legacy migration, last-card prior-discard shuffle, singleton, lethal interruption, invalid zones/shuffle rollback, full configured eight-card conservation and projection isolation. Two peers observe identical public discards, never private remaining order/binding; restoration corruption rejects atomically and room replacement clears the readonly list. Existing full baseline and three Playwright configurations remain green.

Self-review: interfaces and legacy cases explicit; no unresolved rule inference beyond repository-recorded lifecycle. Self-approved under user delegation, current branch/directory. Preserve initial dirty inventory and save scoped source deltas when staging cannot separate prerequisites.
