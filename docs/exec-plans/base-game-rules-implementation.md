# Base-game rules implementation plan

## Objective

Deliver a rules-correct, reconnectable base-game loop from setup through victory or defeat. The server owns canonical state and hidden information; `packages/engine` remains deterministic and framework-independent; clients send validated intent commands only.

The current baseline implements investigator selection and the Travel, Rest, Prepare for Travel, and End Actions portions of the Action phase. The supplied rulebook is the teaching source. The separate Reference Guide is a required input before declaring rules completeness because the rulebook identifies it as authoritative for exceptions.

## Progress

Last updated: 2026-10-03

- Milestone 0: **in progress**. The 16-page authoritative Reference Guide is checksummed, visually verified, and mapped to implementation status in `docs/rules/base-game-reference-guide.md`. The supplied 2024 Ultimate FAQ compilation is also checksummed and classified by provenance in `docs/rules/base-game-faq.md`; only reproduced errata and explicitly marked official FFG answers qualify as authoritative regression sources. All four base-game Ancient One sheets, all 43 base-game Monster tokens, all nine base-game Gate tokens, the complete 51-card English Mythos roster, all 16 base-game Mysteries, the 1-8 player Icon Reference tables, all 40 base-game Asset fronts plus their shared back, and all 36 location encounter fronts across General, America, Europe, and Asia/Australia are scan-verified. Asset values, traits, timing categories, and effect text are structured from the supplied JSON, but effects remain non-executable and require card-by-card verification. Mythos, Mystery, and location encounter effects also remain non-executable. A validated readiness inventory prevents complete setup while families are absent or unverified. Remaining blockers include other encounter families and incomplete possession categories.
- Content update: All 36 base-game Condition cards and 20 base-game Spell cards have paired English front/back crops and validated physical-copy catalogs. Reverse images are server-private. Condition backs have server-private mechanical transcriptions; Spell backs remain untranscribed. Their full flip/trigger sequences are non-executable. The new import now catalogs all 14 Artifacts and all four remaining encounter families (86 fronts); these sources are no longer absent. Artifact text is transcribed; new encounter mechanics/execution are pending. See `docs/rules/base-game-token-encounters-and-artifacts.md`.
- Condition lifecycle update: physical Condition copies and their supply are now server-private; only front identities synchronize. Bank Loan/Debt, optional Rest recovery for Injury/Madness, and Debt/Detained local Influence actions are executable with tests and reconnect-safe owner choices. Blessed/Cursed test thresholds and opposite-kind cancellation work. Their front-side Reckoning dice and discard thresholds have an internal Mythos-only resolver, but no live Mythos trigger. Injury/Madness Reckoning tests now reuse authoritative Strength/Will tests and Clue rerolls when the card's reverse has a typed handler. Five verified reverses are executable: Karmic Justice, Beloved of Bast, Visions of Hypnos, Stabbing Pain, and Delusions. The other 31 reverse effects remain blocked. The remaining Condition path is live phase triggers and authorized flips, then the remaining reverse handlers; this depends on Mythos/Reckoning sequencing and several still-absent Gates, Monsters, possession-trait, devouring, and choice operations. Do not mark the family executable before those handlers and multiplayer tests exist.
- Milestone 1: **complete**.
  - Completed: strict versioned command envelopes (`87f5753`).
  - Completed: successful transitions advance the canonical version exactly once; rejected transitions do not mutate state (`4e2c438`).
  - Completed: the server rejects stale commands and the web client sends the version it observed (`6f1d94a`).
  - Completed: canonical hidden deck/token order is stored outside synchronized Colyseus state, with a public projection that excludes it (`60944a7`).
  - Completed: deterministic dice, shuffle, token-draw, and ID input queues with reproducibility and validation tests (`7d6fa50`).
  - Completed: serializable pending decisions, owner authorization, bounded selections, command pausing, and player-specific option projections (`17f5aea`, `b4100a8`).
  - Completed: public decision summaries plus targeted private option delivery restored on reconnect (`db75d5a`).
- Milestone 2: **in progress**. Host-authorized Ancient One selection is synchronized and required before game start (`0600116`, `34b69f2`, `fdd4fc2`). Game start deterministically shuffles the selected Ancient One's four-card Mystery deck from explicit server inputs and stores remaining order privately (`f021070`, `0600b42`, `2db28b3`, `135011f`). Starting Assets are granted by stable ID, removed from the deck, and the remaining deck is shuffled privately before four cards are exposed in the Reserve (`ca840ed`, `5884d37`). Doom, Omen, the Ancient One-specific three-stage Mythos deck, the nine-card private Gate stack, and a finite normal-Monster cup excluding selected Ancient One set-asides are initialized. Game start now places the Reference-card-counted starting Gates, their Monsters, and starting Clues authoritatively. Active Expedition placement and Mystery card entry effects remain pending; all Expedition scans are now cataloged, with mechanical transcription/execution still pending.
- Milestone 3: **in progress**. The five base skills, improvements, modifiers, minimum-one-die rule, success counting, and highest-item-bonus rule are implemented in the pure engine (`d663e4f`, `5b5ea1d`). Active tests and sequential one-Clue rerolls are authoritative, serializable, reconnectable, and presented through an owner-only dice interface (`c7ac9bd`, `71cb4c6`, `eee76c9`). Shared Health/Sanity loss and recovery primitives, defeat choices, and replacement-investigator state are implemented (`8570990`, `d406c9f`, `8479e25`), but encounter/Mythos effects do not yet invoke the damage and replacement lifecycle. Blessed/Cursed test thresholds are implemented (`61c143a`); Condition gain/flip/Reckoning is pending.
- Milestone 4: **in progress**. Acquire Assets uses the generic authoritative Influence-test lifecycle, including improvements, typed bonuses, Clue rerolls, reconnect-safe value selection, atomic inventory/Reserve updates, Reserve refill, and the optional discard after buying nothing (`5be684f`, `71cb4c6`). Delayed investigators stand up instead of acting (`c8acffe`); same-space Trade uses an explicit offer and recipient acceptance (`a5ddf7f`). Bank Loan/Debt, Charlie Kane's direct transfer, and general component actions remain pending.
- Milestone 5: **in progress**. A deterministic generic combat kernel handles Will/Horror before Strength/Damage, simultaneous Health loss, toughness, and partial Monster damage (`0efd87d`). The active Encounter investigator can now fight an on-space Monster through a server-authoritative command. Fought instance IDs persist through room state, preventing repeats; surviving Monsters block location decks and hand off the turn once all are fought. Combat defeat enters the existing defeat-choice lifecycle. The undrawn cup stays server-private. Monster-specific combat text and untyped possession effects still stop safely. Milestone 6 is **in progress** at the content layer: all four location encounter decks have scan-verified artwork and deck/section metadata, with a guarded subset of their effects executable. Milestone 7 is **in progress** with private top-card draw, revealed-card state, duplicate-draw prevention, and empty-deck loss; all 51 printed icon sequences now have structured scan-verified data, while printed card-effect resolution remains partial. Milestone 11 is **not started**. Milestone 8 remains **in progress** through the standalone defeat/replacement lifecycle. Milestone 12 is **in progress**: started-game seats survive disconnects and can be reclaimed with a private seat token (`fe69bc1`); a two-browser setup/Asset/Travel smoke test runs in Playwright (`ee2542c`). Durable room persistence, broader browser cases, and deployment recovery remain pending.
- Milestone 9: **in progress**. The pure engine can add authoritative Mystery progress, solve at the content-defined target, draw a replacement from private state, win after the third solved Mystery, and reject commands after a terminal result (`103a1cf`, `7f9d762`). The room synchronizes progress and terminal results (`ef5f7a3`), and the web client presents both without deciding outcomes (`15b17ad`). Encounter, combat, Mythos, and Ancient One effects still need to invoke this internal lifecycle at their verified timing points; Rumors, awakening Final Mysteries, and global loss conditions remain pending.
- Milestone 10: **in progress**. A small typed effect vocabulary executes supported portions of Personal Assistant, Fine Clothes, King James Bible, and Private Care (`b59673b`, `bf76b08`). Free-form card text is never parsed at runtime; remaining Asset behavior stays explicitly unsupported until prerequisite systems exist.
- Monster spawning dependency: an internal deterministic cup draw now creates a public on-board instance, applies six typed printed move destinations, and resolves Wraith's Cursed gain. Empty-cup handling in a full icon sequence and Gate/Mythos trigger wiring remain pending; see `docs/rules/base-game-monsters.md`.
- Gate opening dependency: the top private Gate can now be revealed on its printed city and its Monster spawned in one atomic internal transition. The finite-cup-empty case still opens the Gate. Setup and Mythos triggers, closure, and UI presentation remain pending; see `docs/rules/base-game-gates.md`.
- Omen dependency: the internal Mythos Omen step now reads active Gates, applies matching-Gate Doom, handles Azathoth's green tokens and zero-Doom loss, and refuses unsupported awakening for the other Ancient Ones. Revealed-card icon sequencing remains pending; see `docs/rules/base-game-mythos.md`.
- Clue import: all 36 base-game location-bearing faces and the shared back are scan-verified and generated, with one physical token per board space. Setup and replacement draw physical starting Clues from the private pool. Internal spawn places opaque board markers and recycles the discard pile; internal gain and encounter-collection transitions move physical tokens into private holdings; rerolls discard physical Clues, trades transfer them, defeat sets them aside on the defeated investigator's sheet, and Delusions discards them. Public opaque markers now render on the board and in its location inspector. An internal reference-card-counted Mythos Clue-icon step is tested but awaits the common icon sequencer. Other Condition effects, encounter-phase invocation, and defeated-investigator encounters remain; see `docs/rules/base-game-clues.md`. All Research and other encounter-family artwork is now imported separately; their mechanical transcription/execution remains pending.
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
- Encounter outcomes now cover capped resource recovery, Health/Sanity loss, physical Condition gain, Delay, skill improvements, physical Clue awards/discards/spawns, and defeat interruption. Ordered sequences, nested tests, optional fully payable costs, printed choices, chosen skills, and targeted Clue placement have a serializable server-only continuation and owner-only browser choices. A defeated investigator stops later effects; the card cycles once and phase handoff resumes after the authorized defeat choice. Possession effects, movement, Monster targeting, and other encounter families remain pending. Task 1 is not complete: Research, Other World, Expedition, and Special scans are now present and cataloged, but mechanical transcription/execution and remaining Action/combat/component behavior still require implementation.
- Authoritative standard combat now applies Blessed/Cursed success thresholds to both printed tests rather than using the default 5-6 threshold. Combat Clue rerolls, possession effects, and investigator abilities remain pending.
- Research preparation now includes internal exact-marker relocation and discard transitions with physical-token conservation and privacy tests. Card transcription, Research draw/choice integration, and live outcome invocation remain pending; this does not complete Task 1.
- Research transcription: all eight Azathoth cards and their 24 sections now have scan-verified, validated ordered instructions distinguishing encountered-Clue collection from additional supply awards. Omen/Eldritch, Mystery return, and optional named Artifact effects are retained explicitly rather than dropped. These cards remain pending execution; the other 24 Research cards and live draw/choice integration remain pending.
- Guarded Research slice: selected-AO private deck setup, authenticated on-space marker intent, shared ordered/reroll/defeat continuation, exact physical-Clue collection, failed retention, and single card cycling are now wired through server and browser. Twelve Azathoth sections execute; unsupported branches and possession bonuses reject before consumption. Engine/protocol/two-player room tests cover conservation, private continuation, ownership, and phase handoff. Remaining work: the other Ancient Ones' transcription, Omen/Eldritch/Mystery/Artifact handlers, possession bonuses, and dedicated Research browser tests. Task 1 remains incomplete.
- Research Omen update: owner-only choice of four physical spaces moves without Doom; normal advancement shares the Mythos resolver and applies matching Gates plus Azathoth's green tokens, including game-ending Doom. Green token placement/removal is implemented with zero-token no-op. This raises supported Azathoth sections to 22/24; card 5 City (Mystery return) and Sea (optional named Artifact) remain blocked. Tests include ordered outcomes, private multiplayer choice restoration, timing distinctions, and immediate loss. Other-AO Research transcription and encounter possession bonuses remain pending.
- Research Mystery-return update: card 5 City failure now randomly returns one solved Mystery to the private remaining deck and reshuffles, preserving active progress and physical identities; no solved Mystery means no effect. Selected-AO catalog/duplicate checks and four engine plus one multiplayer test cover conservation and privacy. Azathoth coverage is now 23/24 sections. Card 5 Sea awaits physical Artifact supply/holdings and executable effects; its scan is present. Task 1 remains incomplete.
- Artifact foundation: all 14 physical identities initialize in a private shuffled deck; public holdings synchronize and render in an inventory tab. An internal named T'tka Halot transfer enforces conservation and availability, and defeat preserves Artifacts on the defeated sheet. No public grant command is enabled.
- Star Spawn ambush update (2026-10-03): Cthulhu card 5 Sea now resolves Observation failure into printed Star Spawn combat, retaining the Clue and retreating Doom only after victory (capped at 20). Named tokens and their damage remain untouched; no Reckoning fires. Private rerolls, serialization/ownership, defeat interruption and preflight guards reuse the existing continuation. Six additional engine cases and one multiplayer test cover this slice; Cthulhu coverage is 18/24. Next: Ancient One-specific Cultist ambush attributes for cards 1 Wilderness/7 City. Random ambush sourcing, possession bonuses, named Spells/Artifacts and full Task 1 completion remain pending; no new scans are required.
- Deep One ambush update: verified Reference Guide page 2 named-ambush handling (reference attributes, no physical draw/spawn). Will and Strength now use independent owner-private, serializable Clue reroll checkpoints; results resume the printed Research outcome. Investigator defeat stops before rewards/failure effects and cycles once. Existing board/cup/set-aside tokens are unchanged, and unsupported possession/stat guards remain. Eight new engine cases and a multiplayer test cover this slice. Cthulhu card 4 City and card 7 Sea are enabled (17/24 total). Next: Star Spawn named ambush and card 5 Sea's victory Doom retreat. Cultist/random ambush, named Spells/Artifacts and full Task 1 completion remain pending; no new scans are required.
- Cthulhu Research update: all eight cards/24 sections now have scan-verified structured transcriptions. Fifteen sections execute through the shared encounter flow; nine preserve unsupported named ambush, Spell, Artifact and refusal-consequence nodes and reject atomically. Added exact-marker nearest-Sea movement with shortest-route search, private tie choice and serialization, capped Doom retreat, and zero-possession Item-discard handling under the existing Asset guard. Two content tests, 19 engine tests and one room regression cover this slice. Next: named Monster ambush continuation, starting with Deep One Research. Full Cthulhu awakening, possession bonuses and broader Task 1 work remain incomplete; no new scans are needed for the next step.
- Research exchange update: Azathoth card 5 Sea now offers the owner a Dark Pact for the exact encountered Clue and T'tka Halot. Refusal retains the Clue; unavailable/already-held Dark Pact prevents paying; unavailable named Artifact is not duplicated and does not erase the Clue reward. Inconsistent Artifact supply rejects before offering/payment. Five engine regressions and a two-player private serialized-choice test cover this slice. All 24 Azathoth sections are now supported, subject to existing possession-bonus guards. Next: transcribe and execute Cthulhu Research using existing scans. Other Ancient Ones, complex encounters, remaining possession effects and broader Task 1 work remain incomplete.
- Artifact action update: T'tka Halot's Lore test, Clue rerolls, optional Sanity payment and local Monster Health loss now run authoritatively with an inventory control and owner-private target choice. Separate per-card round usage, normal cup return/set-aside exclusion and partial Epic damage are covered by seven engine tests and one room test. Unsupported possession bonuses and Monster special abilities remain guarded. Baseline lint/typecheck/test/build and browser smoke checks passed. Next: enable Azathoth card 5 Sea's Dark Pact exchange. Azathoth stays at 23/24 supported sections; Task 1 remains incomplete.
- Jim Culver's same-space capped Sanity recovery and Trish Scarborough's zero-Clue physical draw now have authenticated investigator-action commands, action expenditure/repeat limits, and browser controls. Jim's component action is not Rest and is legal with a Monster present. Other investigator actions/passives remain pending.
- Location encounters now support owner-selected Madness/Blessed discards into physical supplies, random Madness gains, Lily's optional double improvement, and Mark's optional refusal of Delay/Detained. An explicitly accepted optional Delay cost cannot then be refused while retaining its reward. These abilities are wired only into this encounter interpreter; generic tests/Mythos/combat still need their broader investigator hooks.

### Current verification evidence

- Artifact test Asset integration (2026-10-03): all three supported Tomes now accept the existing sixteen explicit non-combat Assets with physical held/local-City-aura guards. Urban Guide combines with Lore improvements; shared Foot/Case and physical-Clue choices retain private restoration, independent source usage and reroll replacement semantics. Unrelated skill/Spell/combat/Rest effects do not apply. Held/local Whiskey does not prevent the printed Sanity payment or discard itself. Original Artifact validation now covers T'tka Halot as well as the two typed Tomes at initial, resumed and payment/target commands. Thirty-six engine cases and two real room cases added; root lint/typecheck/test/build passed with 599 engine, 64 server, 77 content and 18 protocol cases (758 total). Three browser journeys passed (shared UI regression coverage). No new scans, content effects, network commands or public state fields were needed. Still only 3/14 Artifact gain/effects and partial Task 1.

- Other World foundation (2026-10-03): transcribed scan-backed cards 1 and 2. Card 1's printed Clue-or-Spell reward is preserved and its entire tree remains guarded because Spell gain is not executable. Card 2, The Future, now runs Initial Will −1, immediate exact-Gate closure on a pass, then Observation for two physical supply Clues; Initial failure instead tests Lore and loses 6 Sanity on failure, retaining the Gate. Setup shuffles all 24 physical card IDs, never a supported-only subset. Private original-Gate/location/card binding survives nested tests and physical-Clue rerolls; gate/deck conservation and restored sources validate before RNG. Defeat terminates/cycles once and enters the existing defeat lifecycle. Empty Gate stacks recycle the discard pile privately without reopening the closed Gate. New authenticated Gate intent, server randomness, on-space browser buttons and revealed artwork reuse existing state/dialogs. Held/local Assets or Artifacts, Akachi's closure movement, Yog-Sothoth closure interactions and cards 3–24 remain guarded. Thirty-one engine cases, three content cases, one protocol case and two real room cases added; setup also asserts all-24 private shuffling and duplicate rejection. Root lint/typecheck/test/build passed with 630 engine, 66 server, 80 content and 19 protocol cases (795 total). Three existing browser journeys passed as shared-UI regressions, not dedicated Other World browser coverage. Full Task 1 remains incomplete; no new scans needed.

- Other World card 3 (2026-10-03): City of the Great Race is scan-transcribed and executable within the existing guarded Gate-bound slice. Initial Lore −1 passes to immediate Gate closure, then Will (0) for one physical Clue; Initial failure offers spending one Clue to avoid losing 2 Sanity and gaining Paranoia. The shared optional instruction now preserves an explicit `decline` branch, validates its entire tree, executes it on refusal or inability to pay, and includes it in possession/ambush preflight traversal. Owner-only restored payment validates original Gate/card sources and full physical payment. Depleted Clues never buy the avoidance; missing physical holdings reject atomically. No duplicate Paranoia is drawn, exhausted supply grants nothing, and lethal Sanity loss stops before Condition gain. Added 15 engine cases, one content case and two real room cases; root lint/typecheck/test/build passed with 645 engine, 68 server, 81 content and 19 protocol cases (813 total). Only cards 2 and 3 are executable; card 1 and cards 4–24 remain guarded. No new scans, commands or public/private state fields required.

- Other World card 4 (2026-10-03): Lost Carcosa is transcribed and executable within the existing guarded slice. Initial Lore −1 passes to immediate closure, then an optional Delay cost for two physical Clues; refusal or already Delayed gives no reward but leaves the Gate closed. Accepted costs cannot be refused by Mark while retaining their reward. Initial failure retains the Gate and tests Influence (0), advancing Doom once only on failure. A strict `doom_advance: 1` node emits the existing Doom event without moving Omen. Recursive initial/resumed queue preflight rejects invalid Doom, missing Ancient One, unsupported awakening and awakened replacement effects before RNG/payment/closure. Safe Cthulhu/Shub-Niggurath 2→1 works; Azathoth 1→0 immediately loses, stops, cycles once and does not hand off. Added 23 engine cases, one content case and two real room restoration/ownership cases. Root lint/typecheck/test/build passed: 668 engine, 70 server, 82 content, 19 protocol (839 total). Only cards 2–4 are executable; card 1 and cards 5–24 remain guarded. No new scans, commands or state fields required.

- Other World card 5 (2026-10-03): The Past is scan-transcribed and executable within the existing guards. Influence −1 passes to optional Delay for two physical Clues, then closure after acceptance/refusal/already-Delayed skip. Initial failure tests Strength (0), losing 6 Health only on failure while retaining the Gate. Existing ordered interpreter and damage/defeat lifecycle needed no new handlers or state fields; content schema adds Strength/Health. Sixteen engine cases, one content case and three real room cases verify ordering, restored owner choices/rerolls, physical sources, depleted supply, lethal loss and unsupported awakening rejection. Root lint/typecheck/test/build passed: 684 engine, 73 server, 83 content, 19 protocol (859 total); all three shared browser journeys passed. Only cards 2–5 are executable; unrestricted full-session play remains incomplete.

- Other World card 7 (2026-10-03): The Dreamlands is scan-transcribed and executable within existing guards. Scan icon verification corrected the earlier plan: Initial **Will −1**, not Lore, adds one die per held Clue. A typed `diceBonus: "held_clues"` uses authoritative conserved holdings before the minimum-one clamp; unknown bonuses reject parsing. Initial pass tests Strength, closing only on success, otherwise losing 2 Health then becoming Delayed; lethal loss interrupts Delay. Initial failure Delays then gains Hallucinations; Mark can refuse Delay without skipping the Condition. Recursive initial/resumed validation guards malformed physical Clues and invalid Hallucinations supply before RNG/payment. Depleted supply/duplicate held Condition follows existing semantics. Added 29 engine cases, one content case and three real room cases. Verification totals: 713 engine, 76 server, 84 content, 19 protocol (892 total). Only cards 2–5 and 7 are executable; full-session work remains incomplete.

- Other World card 8 (2026-10-03): The Future is scan-transcribed and executable within existing guards. Initial Will (0) passes to Lore (0), closing only on success and losing 2 Health on failure; Initial failure tests Strength (0), gaining Amnesia only on failure. Content adds the strict Amnesia binding; dynamic preflight extends the existing Hallucinations known/disjoint initialized-pool validation to Amnesia. Existing effects, private nested tests and physical rerolls needed no new commands/state fields. Added 23 engine cases, one content case and four real room cases covering all paths, restored ownership, Condition front privacy/supply, closure, lethal interruption and invalid sources. Root lint/typecheck/test/build passed: 736 engine, 80 server, 85 content, 19 protocol (920 total). Only cards 2–5 and 7–8 are executable; unrestricted full-session work remains incomplete.

- Other World card 9 (2026-10-03): City of the Great Race is scan-transcribed and executable within existing guards. Initial Will (0) passes to Lore (0), closing only on success and losing 2 Health on failure. Initial failure offers one physical Clue to avoid Hallucinations via existing optional `decline`; no Clues or a failed last-Clue reroll automatically gains the Condition. No new engine handler, command or state field was needed. Existing Hallucinations preflight traverses refusal before RNG/payment; restored source/ownership and physical-payment checks remain authoritative. Added 20 engine cases, one content case and three real room cases for both choices, final-Clue boundaries, held/exhausted Conditions, Lore closure, restored guards, privacy and defeat. Verification totals: 756 engine, 83 server, 86 content, 19 protocol (944 total). Only cards 2–5 and 7–9 are executable; full-session work remains incomplete.

- Other World card 10 (2026-10-03): Yuggoth is scan-transcribed and executable within existing guards. Initial Influence (0) passes to Lore (0), closing only on success and losing 1 Sanity on failure. Initial failure offers one physical Clue to avoid losing 2 Sanity via existing optional `decline`. No new engine handler, command or state field was needed. Added 20 engine cases, one content case and four real room cases for exact payment/refusal, final-Clue rerolls, nested closure ordering, restored ownership/source/payment guards, lethal loss on both branches and Azathoth end-game. Verification totals: 776 engine, 87 server, 87 content, 19 protocol (969 total). Only cards 2–5 and 7–10 are executable; full-session work remains incomplete.

- Other World card 11 (2026-10-03): Great Hall of Celaeno is scan-transcribed and executable within existing guards. Initial Lore (0) passes to Will (0), closing only on success and becoming Delayed on failure; Mark can refuse mandatory Delay without closing the Gate. Initial failure offers one physical Clue to avoid Amnesia. Existing interpreter, Condition supply preflight and physical payment handlers suffice; no new engine handler, command or state field. Added 21 engine cases, one content case and four real room cases for payment, final-Clue rerolls, nested tests, Mark refusal, restored source/ownership guards, exhausted/held Conditions and front-only privacy. Baseline lint/typecheck/test/build and three shared browser journeys passed: 797 engine, 91 server, 88 content, 19 protocol (995 total). Only cards 2–5 and 7–11 are executable; full-session work remains incomplete.

- Next scan-independent step: Lost Carcosa (card 12), already scanned and inspected. Initial Observation (0) passes to Lore (0): success closes the Gate; failure gains Paranoia. Initial failure loses 2 Sanity unless becoming Delayed. Verify Paranoia supply preflight, optional Delay affordability/Mark's cost semantics, restored ownership/source choices, rerolls and lethal Sanity loss. No new scans are needed. Cards 1 and 6 retain the Spell gains/holdings dependency.

- De Vermis Mysteriis update (2026-10-03): scan-verified Item/Tome Lore test now offers an optional owner-private 1-Sanity payment combined with a chosen skill improvement. All five skills are selectable; Lily may improve once or twice, capped at +2. Failure, decline and insufficient spendable Sanity finish one component action without reward/cost; successful payment increments state version once and preserves the card. Generalized original-source guards for the two typed Tomes, independent round usage and restored eligibility checks. Enabled this verified card as a conserved named gain/true top Puzzle Box draw, never a search. Twenty-eight new engine cases, one Puzzle Box top-card case, content/protocol assertions and two real room cases cover payment, cap, Lily, privacy, restoration and unauthorized input. Root lint/typecheck/test/build passed with 563 engine, 62 server, 77 content and 18 protocol cases (720 total). Browser outcome recorded in the owner guide below. Only 3/14 Artifact gain/effects are supported; full Task 1 remains incomplete.

- Completed scan-independent step: integrated the existing explicit non-combat Asset applicability into T'tka Halot, Cultes des Goules and De Vermis Mysteriis Lore tests; evidence and limitations are recorded above.

- Cultes des Goules update (2026-10-03): scan-verified Item/Tome Lore action now offers an owner-private optional 1-Sanity payment for two physical supply Clues after the final successful test. Failed/declined/insufficient-Sanity actions consume one action; the card remains held and has independent round usage. Source identities revalidate on initial/resumed/payment commands; paid rewards check catalog conservation across supply, discards, holdings, board markers and defeated sheets. Typed content enables this card as an internal named gain or true top Puzzle Box draw, never a search. Twenty-seven new Cultes engine cases, one Puzzle Box top-card case, protocol/content assertions and two real room cases cover the slice. Root lint/typecheck/test/build passed: 534 engine, 60 server, 77 content, 18 protocol cases (689 total). All three browser journeys passed on rerun; the initial run failed in the existing randomized Charlie/starting-Monster setup, not the new Artifact flow. Artifact-specific browser coverage remains future work. **Only 2/14 Artifact gains/effects are supported**, and carried Assets remain guarded for these Artifact Lore actions. Next: verify and implement De Vermis Mysteriis' Lore/Sanity-for-one-chosen-skill-improvement action, then extend allowed draws. Existing scan present; no new imports required. Full Task 1 and unrestricted Puzzle Box remain incomplete.

- Latest Puzzle Box verification: root lint/typecheck/test/build passed with 506 engine, 58 server, 77 content and 18 protocol cases (659 total). All three existing browser journeys passed; these are shared-dialog regressions, not a dedicated Puzzle Box browser scenario. Final engine assertions verify exactly one state-version increment per accepted immediate result or reroll completion. The two room tests restore both test and remaining-bonus checkpoints. Unrelated Expedition sheets remain untouched.

- Puzzle Box update (2026-10-03): verified the existing value-3 Trinket scan and implemented an optional Observation −2 Rest test, ordinary improvements/City aura/thresholds, Clue and supported Asset die effects, final-pass discard and top-Artifact transfer. Added a private, deep-copied/restorable Rest-source continuation with owner-chosen Witch Doctor/Box order and exactly one action charge. Twenty-seven engine cases and two room regressions cover the flow and guards; sixteen Assets have ordinary encounter applicability. **Artifact limitation remains:** only an actual top T'tka Halot can execute; another top card rejects before dice/discard and can be skipped, never searched past. A conserved depleted supply gives no Artifact. Next: implement Cultes des Goules's Lore/Sanity-for-two-physical-Clues action from its existing scan, then extend executable Artifact gain targets. No new scans needed. Full Task 1 and unrestricted Puzzle Box draws remain incomplete.

- Latest Witch Doctor verification: root lint/typecheck/test/build passed with 478 engine, 56 server, 77 content and 18 protocol cases (629 total). All three existing browser journeys passed; they cover shared dialogs and multiplayer regressions, not a dedicated Witch Doctor browser scenario. The two Witch Doctor room tests cover both authoritative choices and private restoration. Unrelated Expedition source sheets remain untouched.

- Witch Doctor update (2026-10-03): scan-verified same-space optional additional Health-or-Cursed-discard Rest choice. Added a typed node and owner-private continuation after ordinary recovery and Injury/Madness rolls, with capped healing, physical Cursed return, Ally conservation and deferred single-action completion. Twenty-three engine cases and two real room regressions cover both outcomes, decline, Bible/Condition sequencing, eligibility, authorization, restoration and handoff. Fifteen Assets now have ordinary encounter applicability. No new scans required. Next: verify and implement Puzzle Box's optional Rest Observation test and physical Artifact reward, preserving the shared Rest completion boundary. Full Task 1 remains incomplete.

- Latest Cigarette Case verification: lint/typecheck/test/build passed with 454 engine, 54 server, 77 content and 18 protocol cases (603 total). All three existing browser journeys passed. They cover the shared dialog and reroll regressions, not a dedicated modifier browser scenario; the modifier-specific room test covers authoritative source selection, private restoration and purchase budget.

- Lucky Cigarette Case update (2026-10-03): scan-checked optional once-per-round +1 to a test die result, not a reroll. Added independent physical-source usage, source-specific private options, no-RNG modification event, success recalculation and a browser action label. Fourteen Assets now have ordinary encounter applicability. Twenty-two engine cases and a two-client room regression cover Fine Clothes, thresholds, reroll ordering, Research, conservation/authorization and restoration. Only die results 1–5 are targets; above-six, fixed non-test rolls, combat/ambush and Other World integration are not enabled. Next: Witch Doctor's same-space optional Rest recovery/Cursed-discard choice from the existing scan. Full Task 1 remains incomplete.

- Latest Whiskey verification: lint/typecheck/test/build passed with 432 engine, 53 server, 77 content and 18 protocol cases (580 total). Three existing browser journeys passed three repetitions each (nine executions). The initial browser run exposed a legal random starting-Monster restriction in Charlie's Acquire Assets fixture; the fixture now uses ordinary Travel to adjacent numbered City 1 when San Francisco is occupied. No production rule was weakened. Browser coverage is shared UI regression coverage, not a dedicated Whiskey journey; the real Research room regression covers Whiskey ownership/restoration.

- Whiskey update (2026-10-03): added scan-checked optional same-space up-to-two Sanity prevention to ordinary location/Research. Thirteen Assets now have explicit encounter applicability. Declines track physical sources independently; Bandages and Whiskey choices finish before simultaneous damage/defeat. Older checkpoints restore, and all choices revalidate the exact offered card. Twenty-seven additional engine cases and a two-client real Research regression cover amount selection, source interaction, conservation, privacy/restoration and defeat boundaries. Paid matching-resource costs, ambush and other damage contexts remain guarded. Next: Lucky Cigarette Case's optional once-per-round +1 to one test die result (not a reroll), visually verified from the existing scan. Full Task 1 remains incomplete.

- Latest Bandages verification: lint/typecheck/test/build passed with 405 engine, 52 server, 77 content and 18 protocol cases. Three existing browser journeys passed three repetitions each (nine executions), not dedicated Bandages browser coverage. Hardened the initial post-start browser command against stale schema versions and corrected the Bank Loan test to preserve Mystery-granted starting Conditions. No production validation or random setup behavior was weakened.

- Bandages update (2026-10-03): verified Item/optional same-space up-to-two Health prevention. Added typed applicability and a private internal damage checkpoint before simultaneous damage/defeat, colleague-owned choices, amount selection and conservation-checked discard. Twelve Assets now have ordinary encounter applicability. Twenty-nine engine cases and a two-client Azathoth Research regression cover restoration, privacy, loss/defeat boundaries and Item-discard ordering. Paid Health costs and same-space ambush reactions remain guarded; other damage contexts and full Task 1 are incomplete. Next: Whiskey's analogous Sanity prevention using its existing scan.

- Latest Hired Muscle verification: root lint/typecheck/test/build passed with 376 engine, 51 server, 77 content and 18 protocol cases. All three existing browser journeys passed separately after the build; they cover the shared dialog, not a dedicated Hired Muscle click path. Unrelated Expedition source sheets remain untouched.

- Hired Muscle update (2026-10-03): scan-verified Ally Strength bonus and optional Strength reroll reuse typed handlers; eleven Assets now have non-combat applicability. Twelve engine cases and a real two-client General 10 Sea regression cover bonus stacking, exclusions, Condition Reckoning, source limits/restoration, authorization and guarded ambushes. No new network input, state field or UI rule logic. Combat/Other World and full Task 1 remain incomplete. Next: Bandages' optional same-space Health-loss prevention in ordinary encounters, with pending-damage-before-defeat and physical-discard tests; existing scan available.

- Latest Foot verification: root lint/typecheck/test/build passed with 364 engine, 50 server, 77 content and 18 protocol cases. All three browser journeys passed, followed by nine successful executions with `--repeat-each=3`. The Lily fixture uses legal Travel to Tokyo if setup's single Monster occupies Shanghai; the existing no-op Reserve discard retries stale-version rejection. No rule or state-version validation was weakened.

- Lucky Rabbit's Foot update (2026-10-03): visually verified once-per-round any-test reroll and Trinket-only trait. Added typed `round_test_reroll`, physical round usage, cloning/projection, setup/next-round resets, room schema/adapter and card-specific option labels. Ten Assets now have non-combat applicability. Fifteen engine cases, a room regression and a Lily browser journey verify scope, source interaction, conservation, ownership/restoration and reset. Combat/ambush, Other World and full Task 1 remain incomplete. Next: Hired Muscle's Strength bonus and optional Strength reroll from its existing scan.

- Latest Item-discard verification: lint/typecheck/build passed; full tests passed with 349 engine, 49 server, 77 content and 18 protocol cases; both browser journeys passed. Rerun browser checks separately from Nuxt build/typecheck to avoid shared generated-file churn. The Personal Assistant smoke fixture now waits for cross-browser lobby acknowledgements and retries only its initial test command if rejected as stale, never a reroll.

- Research Item-discard update (2026-10-03): rechecked Cthulhu cards 3 City and 6 Wilderness scans; implemented mandatory sequential owner-only choices, trait filtering, physical Asset discard conservation, shortage/zero handling and nearest-Sea continuation ordering. Twelve new engine cases and one room regression cover success/failure, invalid choices, duplicate identities, serialization/privacy and handoff. The nine-Asset applicability roster and 18/24 Cthulhu section count are unchanged; supported sections now work with eligible held Items. Next: Lucky Rabbit's Foot's optional non-combat test reroll using the existing scan. Other possession/combat/complex-encounter work and full Task 1 remain incomplete.

- Latest Personal Assistant verification: root lint/typecheck/test/build passed; 337 engine, 48 server, 77 content and 18 protocol tests passed; both browser journeys passed. Earlier counts below describe historical slices.

- Personal Assistant update (2026-10-03): visually verified Influence bonus and optional one-die free reroll are wired to generic tests (including Acquire Assets) and ordinary location/Research. Nine Assets now have explicit non-combat support. Per-test consumed-source tracking survives restoration; free and physical-Clue rerolls are separately labeled, owner-authorized and usable in either order. Engine, room and browser regressions added. Combat/ambush and Other World remain guarded. Next: implement Research Item-discard choices and physical discard conservation using existing scans. Full Task 1 remains incomplete.

- Scoped non-combat Asset update (2026-10-03): eight scan-verified Assets can be carried in supported location/Research encounters: seven have no applicable effects and Urban Guide contributes one die to same-City investigators. Explicit applicability metadata replaces the blanket guard only for this slice; unknown/reaction cards, Item-discard branches with held Items, and carried-Asset/local-aura ambush branches reject atomically before rolling. Seventeen engine cases, one content case and one multiplayer case verify dice, scope exclusions, physical Clue rerolls, serialization and ownership. Next: Personal Assistant's global Influence bonus and optional Asset reroll in encounters. Combat, Reckoning, other possession effects and full Task 1 remain incomplete; no new scans needed.

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
