# Base-game rules implementation plan

## Objective

Deliver a rules-correct, reconnectable base-game loop from setup through victory or defeat. The server owns canonical state and hidden information; `packages/engine` remains deterministic and framework-independent; clients send validated intent commands only.

The current baseline implements investigator selection and the Travel, Rest, Prepare for Travel, and End Actions portions of the Action phase. The supplied rulebook is the teaching source. The separate Reference Guide is a required input before declaring rules completeness because the rulebook identifies it as authoritative for exceptions.

## Progress

Last updated: 2026-09-29

- Milestone 0: **in progress**. The 16-page authoritative Reference Guide is checksummed, visually verified, and mapped to implementation status in `docs/rules/base-game-reference-guide.md`. The supplied 2024 Ultimate FAQ compilation is also checksummed and classified by provenance in `docs/rules/base-game-faq.md`; only reproduced errata and explicitly marked official FFG answers qualify as authoritative regression sources. All four base-game Ancient One sheets, all 43 base-game Monster tokens, all nine base-game Gate tokens, the complete 51-card English Mythos roster, all 16 base-game Mysteries, the 1-8 player Icon Reference tables, all 40 base-game Asset fronts plus their shared back, and all 36 location encounter fronts across General, America, Europe, and Asia/Australia are scan-verified. Asset values, traits, timing categories, and effect text are structured from the supplied JSON, but effects remain non-executable and require card-by-card verification. Mythos, Mystery, and location encounter effects also remain non-executable. A validated readiness inventory prevents complete setup while families are absent or unverified. Remaining blockers include other encounter families and incomplete possession categories.
- Content update: All 36 base-game Condition cards and 20 base-game Spell cards now have paired English front/back crops and validated physical-copy catalogs. Reverse images are server-private. Condition backs have server-private mechanical transcriptions; Spell backs remain untranscribed. Their full flip/trigger sequences are non-executable. Artifacts and other encounter families remain absent.
- Condition lifecycle update: physical Condition copies and their supply are now server-private; only front identities synchronize. Bank Loan/Debt, optional Rest recovery for Injury/Madness, and Debt/Detained local Influence actions are executable with tests and reconnect-safe owner choices. Blessed/Cursed test thresholds and opposite-kind cancellation work. Their front-side Reckoning dice and discard thresholds have an internal Mythos-only resolver, but no live Mythos trigger. Injury/Madness Reckoning tests now reuse authoritative Strength/Will tests and Clue rerolls when the card's reverse has a typed handler. Five verified reverses are executable: Karmic Justice, Beloved of Bast, Visions of Hypnos, Stabbing Pain, and Delusions. The other 31 reverse effects remain blocked. The remaining Condition path is live phase triggers and authorized flips, then the remaining reverse handlers; this depends on Mythos/Reckoning sequencing and several still-absent Gates, Monsters, possession-trait, devouring, and choice operations. Do not mark the family executable before those handlers and multiplayer tests exist.
- Milestone 1: **complete**.
  - Completed: strict versioned command envelopes (`87f5753`).
  - Completed: successful transitions advance the canonical version exactly once; rejected transitions do not mutate state (`4e2c438`).
  - Completed: the server rejects stale commands and the web client sends the version it observed (`6f1d94a`).
  - Completed: canonical hidden deck/token order is stored outside synchronized Colyseus state, with a public projection that excludes it (`60944a7`).
  - Completed: deterministic dice, shuffle, token-draw, and ID input queues with reproducibility and validation tests (`7d6fa50`).
  - Completed: serializable pending decisions, owner authorization, bounded selections, command pausing, and player-specific option projections (`17f5aea`, `b4100a8`).
  - Completed: public decision summaries plus targeted private option delivery restored on reconnect (`db75d5a`).
- Milestone 2: **in progress**. Host-authorized Ancient One selection is synchronized and required before game start (`0600116`, `34b69f2`, `fdd4fc2`). Game start deterministically shuffles the selected Ancient One's four-card Mystery deck from explicit server inputs and stores remaining order privately (`f021070`, `0600b42`, `2db28b3`, `135011f`). Starting Assets are granted by stable ID, removed from the deck, and the remaining deck is shuffled privately before four cards are exposed in the Reserve (`ca840ed`, `5884d37`). Doom, Omen, the Ancient One-specific three-stage Mythos deck, the nine-card private Gate stack, and a finite normal-Monster cup excluding selected Ancient One set-asides are initialized. Game start now places the Reference-card-counted starting Gates, their Monsters, and starting Clues authoritatively. Active Expedition placement and Mystery card entry effects remain pending; Expedition encounter content is absent.
- Milestone 3: **in progress**. The five base skills, improvements, modifiers, minimum-one-die rule, success counting, and highest-item-bonus rule are implemented in the pure engine (`d663e4f`, `5b5ea1d`). Active tests and sequential one-Clue rerolls are authoritative, serializable, reconnectable, and presented through an owner-only dice interface (`c7ac9bd`, `71cb4c6`, `eee76c9`). Shared Health/Sanity loss and recovery primitives, defeat choices, and replacement-investigator state are implemented (`8570990`, `d406c9f`, `8479e25`), but encounter/Mythos effects do not yet invoke the damage and replacement lifecycle. Blessed/Cursed test thresholds are implemented (`61c143a`); Condition gain/flip/Reckoning is pending.
- Milestone 4: **in progress**. Acquire Assets uses the generic authoritative Influence-test lifecycle, including improvements, typed bonuses, Clue rerolls, reconnect-safe value selection, atomic inventory/Reserve updates, Reserve refill, and the optional discard after buying nothing (`5be684f`, `71cb4c6`). Delayed investigators stand up instead of acting (`c8acffe`); same-space Trade uses an explicit offer and recipient acceptance (`a5ddf7f`). Bank Loan/Debt, Charlie Kane's direct transfer, and general component actions remain pending.
- Milestone 5: **in progress**. A deterministic generic combat kernel handles Will/Horror before Strength/Damage, simultaneous Health loss, toughness, and partial Monster damage (`0efd87d`). The active Encounter investigator can now fight an on-space Monster through a server-authoritative command. Fought instance IDs persist through room state, preventing repeats; surviving Monsters block location decks and hand off the turn once all are fought. Combat defeat enters the existing defeat-choice lifecycle. The undrawn cup stays server-private. Monster-specific combat text and untyped possession effects still stop safely. Milestone 6 is **in progress** at the content layer: all four location encounter decks have scan-verified artwork and deck/section metadata, with a guarded subset of their effects executable. Milestone 7 is **in progress** with private top-card draw, revealed-card state, duplicate-draw prevention, and empty-deck loss; all 51 printed icon sequences now have structured scan-verified data, while printed card-effect resolution remains partial. Milestone 11 is **not started**. Milestone 8 remains **in progress** through the standalone defeat/replacement lifecycle. Milestone 12 is **in progress**: started-game seats survive disconnects and can be reclaimed with a private seat token (`fe69bc1`); a two-browser setup/Asset/Travel smoke test runs in Playwright (`ee2542c`). Durable room persistence, broader browser cases, and deployment recovery remain pending.
- Milestone 9: **in progress**. The pure engine can add authoritative Mystery progress, solve at the content-defined target, draw a replacement from private state, win after the third solved Mystery, and reject commands after a terminal result (`103a1cf`, `7f9d762`). The room synchronizes progress and terminal results (`ef5f7a3`), and the web client presents both without deciding outcomes (`15b17ad`). Encounter, combat, Mythos, and Ancient One effects still need to invoke this internal lifecycle at their verified timing points; Rumors, awakening Final Mysteries, and global loss conditions remain pending.
- Milestone 10: **in progress**. A small typed effect vocabulary executes supported portions of Personal Assistant, Fine Clothes, King James Bible, and Private Care (`b59673b`, `bf76b08`). Free-form card text is never parsed at runtime; remaining Asset behavior stays explicitly unsupported until prerequisite systems exist.
- Monster spawning dependency: an internal deterministic cup draw now creates a public on-board instance, applies six typed printed move destinations, and resolves Wraith's Cursed gain. Empty-cup handling in a full icon sequence and Gate/Mythos trigger wiring remain pending; see `docs/rules/base-game-monsters.md`.
- Gate opening dependency: the top private Gate can now be revealed on its printed city and its Monster spawned in one atomic internal transition. The finite-cup-empty case still opens the Gate. Setup and Mythos triggers, closure, and UI presentation remain pending; see `docs/rules/base-game-gates.md`.
- Omen dependency: the internal Mythos Omen step now reads active Gates, applies matching-Gate Doom, handles Azathoth's green tokens and zero-Doom loss, and refuses unsupported awakening for the other Ancient Ones. Revealed-card icon sequencing remains pending; see `docs/rules/base-game-mythos.md`.
- Clue import: all 36 base-game location-bearing faces and the shared back are scan-verified and generated, with one physical token per board space. Setup and replacement draw physical starting Clues from the private pool. Internal spawn places opaque board markers and recycles the discard pile; internal gain and encounter-collection transitions move physical tokens into private holdings; rerolls discard physical Clues, trades transfer them, defeat sets them aside on the defeated investigator's sheet, and Delusions discards them. Public opaque markers now render on the board and in its location inspector. An internal reference-card-counted Mythos Clue-icon step is tested but awaits the common icon sequencer. Other Condition effects, encounter-phase invocation, and defeated-investigator encounters remain; see `docs/rules/base-game-clues.md`. Research encounters and other encounter families remain separate later imports.
- The Visions of Hypnos Blessed reverse now gains physical Clues from the finite private supply, including discard recycling; its previous counter-only grant has been removed.
- The internal Mythos draw now resolves the first Clue icon on blue Rumor cards in the same atomic transition. Green cards and remaining Rumor icons still await the ordered Mythos sequencer; no client draw command is exposed.
- Green and yellow Mythos draws now also resolve their first printed Advance Omen icon atomically; unsupported awakening leaves the private deck untouched. Later icons and card effects remain unimplemented.
- A persisted Mythos icon cursor now tracks the first resolved icon and rejects early green-card Clue spawning. Later icon handlers remain to be implemented before a live Mythos command is safe.
- The second green icon, Monster Surge, now has an internal atomic handler: matching current-Omen Gates each receive the Reference-card number of Monsters, or one Gate opens if none match. It advances the icon cursor so green Clue spawning can follow. Live phase invocation and other icons remain pending.
- The third yellow icon, Spawn Gates, now has an internal atomic handler using the player-count Reference card. It is cursor-gated after Reckoning and stops at the finite Gate stack; Reckoning and live phase invocation remain pending.
- A conservative internal yellow Reckoning step now processes single Blessed/Cursed rolls in Lead Investigator order when no higher-priority Ancient One or Monster effect, possession, or multi-Condition choice is present. It refuses unsupported cases before moving the cursor; full Reckoning and live phase invocation remain pending.
- A guarded `ADVANCE_MYTHOS` room command now dispatches one verified printed icon at a time for a Lead Investigator in Mythos, with server-owned randomness and a hard stop at unmodeled card text. Encounter-to-Mythos phase entry and card completion remain pending.
- The four location Encounter decks are now shuffled separately into server-private state at setup. Internal helpers derive legal General/Regional deck choices and advance completed encounters from Lead through all surviving seats into Mythos; no public skip command or unverified card resolution is exposed.
- A guarded room command now draws and resolves a choice-free, supported location Encounter section (initially simple tests and Clue awards), cycles that physical card, and invokes the internal turn continuation. Encounter tests now share the owner-only Clue-reroll decision lifecycle and reveal the active card without exposing the rest of its deck. Unsupported effects and possessions fail before deck consumption; broad encounter coverage remains pending.
- The Encounter phase now exposes mandatory on-space Monster combat with one fight per instance and safe turn handoff. Mythos icon progression is reachable from Encounter. Support of the Church, Perplexing Stars, Omen of Good Fortune, The World Fights Back, Rally the People, Everyone Has a Price, Dimensional Instability, Desperate Times, Calling the Elder Things, The Bermuda Triangle, That Which Consumes, Torn Asunder, Heat Wave Singes the Globe, Blood Flows, Tide of Despair, Unexpected Betrayal, and From Bad to Worse have scan-verified, typed printed effects. Omen of Good Fortune adds an owner-only, reconnect-safe choice of any physical Omen space or no movement without Doom advance. The World Fights Back adds sequential owner-only choices in Lead order for recovery or a non-Epic Monster discard. Rally the People gains the first Ally in the private Asset deck or discard pile and reshuffles the deck. Everyone Has a Price adds sequential owner-only Debt-for-Condition exchanges using finite physical supplies. Dimensional Instability discards Omen-matching Gates and advances Doom per discard, with a public Gate discard pile and private randomized recycling. Desperate Times lets the Lead take a physical Dark Pact instead of two Doom. Calling the Elder Things spawns once per distinct Cultist space from the private Monster cup. The Bermuda Triangle rolls for each surviving investigator and moves and Delays them on a 1 or 2. That Which Consumes uses an owner-only Lead choice to discard an active Gate and advances Doom when its symbol does not match the current Omen. Torn Asunder counts matching Gates for Health loss, advances the Omen when none match, and serializes multiple defeat choices before ending the card. Blood Flows offers the Lead a private non-Epic Monster choice and resolves toughness-based Health loss through defeat. From Bad to Worse applies trait-counted Health and Sanity loss and physical Clue discards through a defeat-safe queue. Unexpected Betrayal queues Ally holders, applies Health loss, discards their chosen Ally, and resumes after defeat. Tide of Despair offers each investigator a private Blessed-discard or combined Health/Sanity-loss choice, resuming after defeat. Heat Wave offers each investigator a private Delay-or-3-Health choice in Lead order and resumes after lethal Health loss. Each opens replacement timing, after which the Lead can begin the next Action round in Lead order. The other 34 printed Mythos texts remain pending.
- Encounter outcomes now cover capped resource recovery, Health/Sanity loss, physical Condition gain, Delay, skill improvements, physical Clue awards/discards/spawns, and defeat interruption. Ordered sequences, nested tests, optional fully payable costs, printed choices, chosen skills, and targeted Clue placement have a serializable server-only continuation and owner-only browser choices. A defeated investigator stops later effects; the card cycles once and phase handoff resumes after the authorized defeat choice. Possession effects, movement, Monster targeting, and other encounter families remain pending. Task 1 is not complete: Research, Other World, Expedition, and Special sources are absent, alongside remaining Action/combat/component behavior.
- Authoritative standard combat now applies Blessed/Cursed success thresholds to both printed tests rather than using the default 5-6 threshold. Combat Clue rerolls, possession effects, and investigator abilities remain pending.

### Current verification evidence

- Engine: 75 tests passing, including generic combat resolution and combat-to-defeat integration in addition to delayed timing, Trade, setup tracks, staged Mythos composition, damage/defeat/replacement, and prior skill, Asset, and Mystery behavior.
- Server: 7 multiplayer integration tests passing, including actual dropped-connection recovery and private decision restoration.
- Root `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass; `pnpm test:e2e` passes its two-browser journey. Server and browser tests need local-port permission in restricted environments.

## Delivery rules

- Build vertical slices in the dependency order below. Do not implement card text directly in Vue or Colyseus rooms.
- Every engine transition has legal, illegal, boundary, and non-mutation tests.
- Every new command is runtime-validated in `packages/protocol` and authorized by the server-derived player identity.
- Randomness enters the engine through explicit seeded/injected inputs. Tests use fixed rolls and draw orders.
- Server-private state contains deck order, token pools, unrevealed card backs, pending random inputs, and secret choices. Public/player-visible projections expose only permitted information.
- Each numbered milestone is a separate feature commit or short commit series: protocol, engine/content, server projection, UI, documentation.
- A milestone is complete only when root lint, typecheck, test, and build pass.

## Milestone 0 - Rules and content authority gate

Scope:

- Add the base-game Reference Guide and checksum it without committing the source PDF. **Complete.**
- Reconcile rulebook, Reference Guide, investigator sheets, cards, map, and component counts.
- Classify every card extraction as verified, needs review, or unusable.
- Inventory missing or unverified structured content: Gates, Assets, Artifacts, Spells, Conditions, Mythos cards, encounters, reference-card player counts, and starting possessions.
- Create stable IDs and cross-reference validation for every component.

Exit criteria:

- No rule is marked complete using OCR-only text.
- Content validation fails on duplicate IDs, missing references, invalid deck composition, or unavailable setup components.
- The implementation matrix links every rule family to its source page or Reference Guide entry.

## Milestone 1 - Deterministic engine and visibility model

Scope:

- Split canonical `GameState` into server-private state and explicit public/player projections.
- Introduce deterministic engine context for dice, shuffles, token draws, IDs, and decision continuation IDs.
- Add pending-decision state for choices that cannot resolve atomically: selecting dice rerolls, choosing encounter decks, choosing Monster order, spending Clues, and selecting acquired cards.
- Model a command result as events plus state and optional pending decision.
- Add state-version or command-sequence protection for reconnecting/stale clients.

Exit criteria:

- Identical state, command, and deterministic inputs produce identical results and events.
- Hidden deck order never appears in synchronized room state or client fixtures.
- Interrupted decisions survive serialization and reconnection.

## Milestone 2 - Complete authoritative setup

Scope:

- Select the Ancient One and Lead Investigator.
- Grant verified starting possessions, Health, Sanity, and starting locations.
- Build the three-stage Mythos deck from Ancient One composition.
- Initialize Doom and Omen.
- Randomize Gate, Clue, and Monster pools.
- Spawn starting Gates, Monsters, Clues, and Active Expedition from player-count reference data.
- Populate the four-card Reserve and reveal the first Mystery.

Exit criteria:

- Setup is reproducible from a seed and produces legal component counts for 1-4 investigators.
- Private draw order remains private while all faceup setup components synchronize.
- Setup fails clearly when required verified content is missing.

## Milestone 3 - Tests, skills, resources, and damage

Scope:

- Implement the five skills, improvements up to +2, modifiers, minimum-one-die rule, and success counting on 5-6.
- Enforce one applicable item skill bonus per test, using the highest bonus.
- Implement Clue spending for individual rerolls through a pending decision.
- Implement Health/Sanity loss and recovery with maximums.
- Add Blessed/Cursed success thresholds only after their verified Condition rules are available.

Exit criteria:

- Dice tests cover zero/negative pools, modifiers, bonuses, rerolls, caps, and deterministic outcomes.
- The UI can display a pending test, results, legal rerolls, and final resolution without choosing outcomes locally.

## Milestone 4 - Complete Action phase

Scope:

- Trade possessions and tickets only between investigators sharing a space.
- Acquire Assets using Influence tests, total-value selection, Reserve refill, optional discard after buying nothing, and verified Bank Loan/Debt behavior.
- Execute investigator, possession, and local component actions through structured effect nodes.
- Support multi-step Travel selection and ticket spending in the UI. **Complete:** select up to three adjacent spaces, preview train/ship costs, undo or cancel, and confirm one authoritative Travel command. Pending decisions and completed Travel actions disable route selection; synchronized state changes clear the draft.
- Handle Delayed investigators by standing them up instead of taking actions.

Exit criteria:

- All six rulebook action families work authoritatively.
- Once-per-round action and once-per-component-action limits survive reconnects.
- Reserve state and player inventory update atomically.

## Milestone 5 - Monsters and Combat Encounters

Scope:

- Model normal and Epic Monsters, toughness, current damage, horror, damage, skill modifiers, traits, and spawn effects.
- Require investigators to choose the order when multiple Monsters share a space.
- Resolve Will/Horror followed by Strength/Damage.
- Apply investigator and Monster damage simultaneously where required.
- Return defeated normal Monsters to the cup and Epic Monsters to the box.
- Implement ambush behavior and its cleanup.

Exit criteria:

- Combat examples from the rulebook reproduce with fixed dice.
- Partially damaged Monsters persist on the board.
- An investigator cannot bypass mandatory combat to take another encounter.

## Milestone 6 - Encounter phase and encounter content

Scope:

- Advance investigators from the Lead Investigator in order, one encounter each.
- Offer legal location decks based on region and space type.
- Implement Research, Other World, Expedition, Rumor, and defeated-investigator token encounters.
- Add complex encounter initial/pass/fail branches.
- Close Gates and move the Active Expedition when instructed.
- Build a constrained encounter-effect vocabulary from verified cards; keep exceptional effects as typed handlers until patterns justify generalization.

Exit criteria:

- Every board space offers only legal encounter choices.
- Encounter deck order is private and deterministic.
- The phase advances to Mythos only after every investigator finishes or is skipped by a rule.

## Milestone 7 - Mythos phase

Scope:

- Resolve Mythos icons strictly left-to-right.
- Advance Omen and Doom for matching Gates.
- Resolve Reckoning in rule order: Monsters, Ancient One, ongoing Mythos, then possessions and Conditions.
- Spawn Gates, Monster surges, Monsters, and Clues using reference-card counts.
- Place Rumor and Eldritch tokens.
- Resolve and discard Event cards; retain Ongoing cards.
- Detect an empty Mythos deck as a loss when a draw is required.
- Pass or retain Lead Investigator according to the rules, then begin a new Action phase and increment the round.

Exit criteria:

- Fixed Mythos fixtures prove icon ordering and cascading state changes.
- Gates, pools, Doom, Omen, ongoing effects, and round transition synchronize correctly.

## Milestone 8 - Defeat, replacement, Doom, and awakening

Scope:

- Resolve zero Health/Sanity defeat, Doom advancement, nearest-City relocation, token state, possession cache, and Lead Investigator transfer.
- Implement devouring and post-Mythos replacement investigators.
- Prevent reuse of defeated/removed investigators.
- Awaken the Ancient One at Doom zero and replace front-side effects with back-side rules.
- Eliminate players defeated after awakening and lose when all are eliminated.

Exit criteria:

- Defeat can interrupt any phase without corrupting phase order or pending decisions.
- Replacement selection is authoritative and reconnect-safe.
- Awakening is idempotent and occurs exactly once.

## Milestone 9 - Mysteries, Rumors, victory, and loss

Scope:

- Model active/completed Mysteries and `when enters play` effects.
- Solve and replace Mysteries immediately when their conditions are met.
- Model Rumor tokens, reckoning clocks, encounters, resolution, and failure effects.
- Win after three Mysteries, plus the Final Mystery when required after awakening.
- Implement all global loss conditions and a terminal game result that rejects further commands.

Exit criteria:

- Every terminal condition has a direct engine test and a multiplayer integration test.
- Simultaneous/competing terminal effects resolve in authoritative rules order.

## Milestone 10 - Cards and investigator abilities

Scope:

- Verify and implement all base Assets, Artifacts, Spells, Conditions, investigator abilities, Ancient One effects, and Mythos/encounter effects.
- Expand the effect vocabulary only from repeated verified patterns.
- Enforce possession restrictions, hidden backs, flip triggers, traits, discards, and component-action limits.
- Add regression fixtures for Reference Guide clarifications and FAQ cases.

Exit criteria:

- Every included component has a stable ID, verified source, executable behavior or an explicit unsupported marker that prevents starting a supposedly complete game.
- No authoritative effect is parsed from free-form OCR text at runtime.

## Milestone 11 - Complete game UX

Scope:

- Add setup controls for Ancient One, difficulty options, and Lead Investigator.
- Add pending-choice dialogs, dice/test UI, combat sequencing, encounter presentation, Mythos resolution timeline, Doom/Omen tracks, Gates, Monsters, Clues, Mysteries, and Rumors.
- Populate the Reserve shelf and player inventory from synchronized state.
- Add a public event log that omits private information.
- Restore focus correctly for dialogs, provide keyboard operation, reduced motion, readable zoom, and mobile layouts.

Exit criteria:

- Two players can complete a seeded game without developer tools.
- Reconnecting during every phase and pending-decision category restores the correct interface.
- The client cannot submit an action that bypasses a server-side rule check.

## Milestone 12 - Full-game verification and release gate

Scope:

- Add seeded full-round and full-game simulations.
- Add browser tests for setup, Action, combat, encounter, Mythos, defeat, reconnect, victory, and loss.
- Add invariants/property tests for component conservation, unique investigators, resource bounds, phase ownership, and hidden-information projections.
- Run multiplayer concurrency and reconnect stress tests.
- Profile SVG board and synchronized-state sizes before considering renderer or transport changes.

Release criteria:

- Root lint, typecheck, test, and build pass from a clean checkout.
- All supported content is verified and the rules matrix has no unexplained gaps.
- No hidden-state leakage is found in browser network snapshots.
- A deterministic seed can reproduce any reported game.
- Known unsupported expansions or optional rules are clearly excluded from the game setup UI.

## Suggested implementation sequence

The critical path is `0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12`.

Content verification for later milestones can run ahead in parallel, but engine behavior must follow this dependency order. In particular, do not implement free-form card effects before deterministic decisions/tests, and do not expose deck state before the private/public projection boundary exists.
