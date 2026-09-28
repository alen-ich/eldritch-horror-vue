# Base-game rules implementation plan

## Objective

Deliver a rules-correct, reconnectable base-game loop from setup through victory or defeat. The server owns canonical state and hidden information; `packages/engine` remains deterministic and framework-independent; clients send validated intent commands only.

The current baseline implements investigator selection and the Travel, Rest, Prepare for Travel, and End Actions portions of the Action phase. The supplied rulebook is the teaching source. The separate Reference Guide is a required input before declaring rules completeness because the rulebook identifies it as authoritative for exceptions.

## Progress

Last updated: 2026-09-28

- Milestone 0: **in progress**. The 16-page authoritative Reference Guide is checksummed, visually verified, and mapped to implementation status in `docs/rules/base-game-reference-guide.md`. The supplied 2024 Ultimate FAQ compilation is also checksummed and classified by provenance in `docs/rules/base-game-faq.md`; only reproduced errata and explicitly marked official FFG answers qualify as authoritative regression sources. All four base-game Ancient One sheets, all 43 base-game Monster tokens, all nine base-game Gate tokens, the complete 51-card English Mythos roster, all 16 base-game Mysteries, the 1-8 player Icon Reference tables, and all 40 base-game Asset fronts plus their shared back are scan-verified. Asset values, traits, timing categories, and effect text are structured from the supplied JSON, but effects remain non-executable and require card-by-card verification. Mythos and Mystery effects also remain non-executable. A validated readiness inventory prevents complete setup while families are absent or unverified. Remaining blockers include English encounter cards and incomplete possession categories.
- Milestone 1: **complete**.
  - Completed: strict versioned command envelopes (`87f5753`).
  - Completed: successful transitions advance the canonical version exactly once; rejected transitions do not mutate state (`4e2c438`).
  - Completed: the server rejects stale commands and the web client sends the version it observed (`6f1d94a`).
  - Completed: canonical hidden deck/token order is stored outside synchronized Colyseus state, with a public projection that excludes it (`60944a7`).
  - Completed: deterministic dice, shuffle, token-draw, and ID input queues with reproducibility and validation tests (`7d6fa50`).
  - Completed: serializable pending decisions, owner authorization, bounded selections, command pausing, and player-specific option projections (`17f5aea`, `b4100a8`).
  - Completed: public decision summaries plus targeted private option delivery restored on reconnect (`db75d5a`).
- Milestone 2: **in progress**. Host-authorized Ancient One selection is synchronized and required before game start (`0600116`, `34b69f2`, `fdd4fc2`). Game start now deterministically shuffles the selected Ancient One's four-card Mystery deck from explicit server inputs, stores the remaining order privately, and synchronizes only public Mystery state (`f021070`, `0600b42`, `2db28b3`, `135011f`). Entry effects remain pending. The remaining setup steps depend on the outstanding content listed in Milestone 0.
- Milestones 3-8 and 10-12: **not started**.
- Milestone 9: **in progress**. The pure engine can add authoritative Mystery progress, solve at the content-defined target, draw a replacement from private state, win after the third solved Mystery, and reject commands after a terminal result (`103a1cf`, `7f9d762`). The room synchronizes progress and terminal results (`ef5f7a3`), and the web client presents both without deciding outcomes (`15b17ad`). Encounter, combat, Mythos, and Ancient One effects still need to invoke this internal lifecycle at their verified timing points; Rumors, awakening Final Mysteries, and global loss conditions remain pending.

### Current verification evidence

- Protocol: 13 tests passing, including Ancient One command validation and decision payload invariants.
- Engine: 28 tests passing, including host-only Ancient One selection, Mystery setup preconditions, private deck projection, progress, replacement draws, victory, terminal rejection, decisions, and deterministic inputs.
- Content: 44 tests passing, including the complete Ancient One, Monster, Gate, Mystery, Asset-front, English Mythos, and Icon Reference rosters, Omen mappings, player-count spawn values, scan asset coverage, setup dependencies, scaled Mystery thresholds, required-family inventory, and incomplete-setup rejection.
- Server: 4 multiplayer integration tests passing, including stale-command rejection and reconnect decision delivery.
- Root `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

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
- Support multi-step Travel selection and ticket spending in the UI.
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
