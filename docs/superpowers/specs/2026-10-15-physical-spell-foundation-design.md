# Physical Spell foundation

Date: 2026-10-15  
Status: Approved by the user on 2026-10-15; implementation requires separate plan review.

## Purpose and outcome

Establish a deterministic, conserved inventory for the 20 physical base-game Spell cards. The server must retain each exact copy and its hidden reverse while clients can inspect only permitted front information. This is the dependency for later Spell effects and Other World cards 1, 6 and 20; it does not enable those encounters.

The requested deliverables are this specification, user review, and then a separate implementation plan. Product implementation is outside the current request.

## Existing system

- `packages/content/src/spells.ts` catalogs ten kinds with two physical copies each, front text/artwork, traits and timing. Reverse text is untranscribed and effects are explicitly non-executable.
- Front images are public; paired reverse images live under `apps/server/private-card-assets/spells/`.
- The engine has physical Artifact and Condition foundations, deterministic shuffle inputs, private deck state, public projection and defeat/replacement lifecycles.
- `GameRoom` reconstructs engine state from synchronized state plus private room fields. Conditions already separate public front identity from private physical identity.
- Physical Spell supply and holdings do not exist yet. Existing encounter/possession guards must remain effective.

## Approach and alternatives

**Recommended: private physical inventory, public front identities.** Follow the Condition boundary, using a focused engine Spell module and minimal integration with existing setup, projection and lifecycle code. This preserves exact copies without exposing reverse identity.

Publishing the catalog's physical IDs would simplify Artifact-style synchronization, but their copy suffixes identify distinct reverse images. Reject that approach.

A generic possession framework could unify several card families, but would expand this task into unrelated refactoring. Defer it until executable Spell behavior demonstrates a shared abstraction.

## Authoritative rules baseline

Source: [FFG Reference Guide](https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/EH01%20Reference%20Guide.pdf), printed pages 5–7 and 11; repository provenance is recorded in `docs/rules/base-game-reference-guide.md`.

- Random double-sided gains draw from the bottom. A deck's top front is inspectable; backs and remaining order are hidden.
- Discarded Spells immediately rejoin their deck and it is shuffled; there is no separate Spell discard pile.
- Random gains replace duplicates until an unowned kind is gained, if available. Named duplicate gains discard the newly obtained copy. Trait searches exclude already-owned kinds.
- Named/trait searches shuffle afterward. Unavailable components grant nothing; cards held by other or defeated investigators are unavailable.
- Spell backs require an authorized reveal; inventory possession alone gives no permission to inspect them.

Record page-specific regression references in the Spell rules notes. Preserve any applicable official errata precedence. The server's injected uniform shuffle represents physical shuffling/cutting; no player cut UI is introduced.

## Scope

### Private state and conservation

Use one combined ordered Spell deck, not separate decks by kind or trait. Document top-to-bottom orientation; random gain removes the last element. Initialize all 20 catalog identities exactly once through injected shuffle input, with empty private player holdings.

Private state records physical IDs for the supply, each seat's holdings and each defeated investigator's cached possessions. Public engine/player views contain Spell front-kind IDs only, such as `spell_wither`, with no copy suffix. Defeated-sheet public views follow the same rule. Do not put hidden fields inside the synchronized lifecycle JSON.

At every inventory transition, the catalog's physical multiset must equal supply plus player holdings plus defeated-sheet holdings: all 20 copies, each once. Reject unknown identities, duplicate placement, missing copies, invalid owner references and multiple held copies of a kind. An initialized empty supply is valid when all cards are accounted for elsewhere. A missing supply is invalid; never silently regenerate it.

Copy/project state without shared mutable inventory arrays. Current in-memory rooms are the compatibility target; durable historical-save migration is outside scope. Normalize absent empty holding lists only when conservation can still be proven.

### Internal operations

Provide typed internal operations for random gain, gain by kind, gain by trait, and discard of one exact owned physical copy. Reuse existing transition/result and deterministic-context conventions. These are server/engine APIs, not new client commands.

All operations validate the active game, recipient eligibility, catalog and conservation before mutation or random consumption. Lobby/terminal games, defeated or eliminated recipients, unknown filters and unowned discard targets reject without changing input state. Legal depletion is a successful no-gain result, distinct from invalid state.

Random duplicate draws return the new copy through ordinary discard/shuffle before retry. First determine whether any unowned kind is available, so an all-duplicate supply terminates as no gain. Do not filter the deck or skip duplicate draws to manufacture a supported result. If deterministic inputs run out, reject atomically rather than publishing partial inventory changes. Randomness consumption on rejection follows the engine's existing context convention; state, events and canonical version must remain unchanged.

Named/trait searches proceed from the bottom and preserve relative order until their required shuffle. Named duplicate handling returns the newly selected copy, retaining the original. Discard returns the exact owned copy to the common deck and uses injected shuffle. No reverse effect executes during any inventory operation.

Internal helpers compose within one authoritative outer transition. The outer transition advances the canonical version exactly once; helper composition must not increment it again.

### Room lifecycle and public view

Round-trip private inventory through room reconstruction, transitions and reconnect without reconstructing copies from public kind IDs. Defeat transfers exact copies to the defeated sheet once; replacement starts empty and does not recycle that cache.

Expose held front kinds and the legally visible top-of-supply front kind, or an empty indicator. Keep all other supply identities, physical IDs, reverse paths and reverse content private. Public events/errors may describe the gained/discarded front but must not include hidden copy details or rejected draw order. Owner-targeted messages have the same hidden-back restriction.

Resolve public kinds through a dedicated safe front mapping. Public inventory artwork must use a canonical front image per kind without deriving a held physical copy. The existing reference archive may retain its public fronts, but runtime holdings must not identify which paired reverse was drawn.

Render synchronized holdings in the existing Spell inventory area, labeled “Effects not implemented.” Show the supply's visible top front in a compact read-only supply view within that area. Do not add casting, flipping, gaining, discarding or trading buttons.

### Integration boundary

Initialize supply during setup, but do not grant starting Spells, enable reward encounters, add trading, or activate Spell effects in this slice. Those require separately verified post-gain behavior. Internal gain/discard can be exercised through engine and room fixtures without a production debug command.

Audit applicable rule entry points so a restored or test-granted Spell cannot silently lose its printed effect: existing unsupported-possession checks must conservatively reject contexts requiring unimplemented Spell behavior before RNG or component consumption. Do not block unrelated legal commands merely because inventory exists. Scope guards by catalog timing where it can be proven irrelevant; otherwise retain a safe explicit unsupported result.

Keep Spells `needs_review` / `not_executable`; successful inventory work is not whole-family readiness.

## Acceptance criteria

1. Setup creates exactly 20 physical copies deterministically, without changing existing public gameplay outcomes.
2. Random, named and trait gains, duplicate rules, depletion and discard obey the rules baseline with conserved physical copies.
3. Invalid ownership, filters, supply or restoration reject without state mutation, events or version advance.
4. Defeat and replacement preserve conservation; reconnect restores the same hidden copies and public fronts.
5. Public projection, synchronized schemas/lifecycle JSON, events, errors and targeted messages contain no physical Spell IDs, reverse identity, reverse URLs or hidden deck order.
6. Public fronts and the visible supply top are rendered from synchronized state; mutating a projected array cannot mutate canonical inventory.
7. No new gain/cast/flip/discard/trade command exists; starting Spells and Other World cards 1, 6 and 20 remain disabled where currently unsupported.
8. Applicable unimplemented Spell effects reject safely; irrelevant inventory does not prevent ordinary play.

## Verification

Add meaningful deterministic engine tests for all gain/discard branches, random duplicate retry, all-duplicate exhaustion, named duplicate return, trait exclusion, malformed conservation, input purity and clone isolation. Include exact source-page references for duplicate/depletion fixtures.

Add real two-client room tests for private inventory round trips, public front synchronization, defeat/replacement, reconnect, room isolation and hidden-field exclusion. Use internal fixture setup, never a production grant endpoint. Add a focused browser inventory check using a test-only fixture if the existing harness can supply authoritative holdings; existing three browser journeys alone do not prove Spell rendering/privacy.

Run relevant targeted tests, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and affected Playwright journeys. Report environmental failures separately from test failures. Update Spell rules notes and implementation status to describe the exact inventory-only scope.

## Deferred follow-up

Typed reverse transcription, casting/actions/reactions, usage limits, trade and recovery from defeated sheets, starting possessions, encounter rewards and unrestricted full-session readiness require subsequent specs or implementation slices. No new scans or framework dependencies are required for this foundation.
