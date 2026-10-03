# Eldritch Horror: your guide to owning the code

Code-inspected snapshot: **3 October 2026**. This is a learning guide, not a claim that the full game is finished. Coverage numbers will change; search the named symbols when line numbers move.

### Navigation

- [Repository and file ownership](#3-repository-map-where-to-look)
- [State, commands, content and results](#4-the-five-objects-you-should-recognize)
- [Follow Rest through the application](#5-trace-a-real-feature-rest)
- [Paused choices and continuations](#6-why-choices-do-not-resolve-in-one-function-call)
- [Implemented coverage and limitations](#9-what-is-doneand-what-is-not)
- [Local development and tests](#10-start-and-inspect-the-project-locally)
- [Your first exercise](#12-your-first-exercise-add-a-small-test)
- [Implementing your own feature](#14-how-to-implement-a-feature-yourself)
- [Debugging](#15-debugging-locate-the-layer-before-changing-code)
- [Reading path](#17-what-to-read-in-order)

## 1. Start here

You do not need to understand the whole repository before making a useful change. First learn where a decision belongs, follow one command, and run one small test. Then expand outward.

The project has four main responsibilities:

| Responsibility | Owner | Plain-language meaning |
| --- | --- | --- |
| Presentation | `apps/web` | Shows the map, cards, buttons, and choices. |
| Connections and delivery | `apps/server` | Associates connections with players, validates messages, and synchronizes permitted state. |
| Rules | `packages/engine` | Decides whether an action is legal and what it changes. |
| Game descriptions | `packages/content` | Describes investigators, map routes, cards, tokens, and typed effects. |

`packages/protocol` is the shared vocabulary: command shapes, event types, identifiers, and decision types.

The most important rule: **the browser requests an action; it does not decide the result.**

```text
Player clicks Rest
  → Vue sends { type: "REST" }
  → server validates message, player identity, and state version
  → engine checks phase, turn, Monsters, and action usage
  → engine returns new state or an error
  → server publishes permitted state
  → Vue redraws Health/Sanity and available actions
```

Think of the engine as the referee, content as the component box, the server as the table coordinator, and Vue as the view of the table.

## 2. What the tools mean

- **TypeScript:** JavaScript with checked types. A type helps catch mistakes during development; it does not validate incoming network data by itself.
- **Vue:** reactive UI components. Changing a reactive value causes the relevant display to update.
- **Nuxt:** the application framework around Vue, including development/build tools, configuration, and asset serving. The current game screen primarily lives in one `app.vue`, not many page routes.
- **Colyseus:** multiplayer rooms and synchronized state. Each game has its own room.
- **Zod:** runtime validation. It checks actual incoming objects rather than trusting their TypeScript annotations.
- **pnpm workspaces:** several packages in one repository. `@eldritch/engine` is a local package, not a remote service.
- **Turborepo:** runs package scripts in dependency order and caches successful results. A cache hit means an earlier result was reused.
- **Vitest:** engine/content/protocol tests.
- **Mocha + Colyseus testing:** real server-room integration tests.
- **Playwright:** browser tests with independent browser sessions.

No database is required for the current game loop. PostgreSQL/Prisma are architectural intentions, not an implemented persistence system. A server restart is not equivalent to a browser reconnect: in-memory room/private data are not durably saved.

## 3. Repository map: where to look

Paths below are relative to `/Users/alenichshanov/Desktop/personal/eldritch-horror-vue`.

### Frontend

| File | What it owns | Open it when… |
| --- | --- | --- |
| `apps/web/app/app.vue` | Main lobby/game shell, map interaction, Reserve, inventory views, many action controls and styles | You want to change the display, a button, map layout, or a visible control. |
| `apps/web/app/composables/useGameRoom.ts` | Create/join/reconnect, SDK connection, synchronized-state decoding, sending commands, private decision messages | A connection or state display is wrong. |
| `apps/web/app/components/EncounterChoicePanel.vue` | Printed encounter choices | You want to improve choice presentation. |
| `apps/web/app/components/InvestigatorActionPanel.vue` | Investigator component-action controls | You are exposing a supported investigator action. |
| `apps/web/app/components/TradePanel.vue` | Trade offer/accept UI | You are changing trade interaction. |
| `apps/web/app/components/DefeatPanel.vue` | Defeat/replacement interaction | You are improving defeat choices. |
| `apps/web/nuxt.config.ts` | Public server URL and web configuration | You need a different game-server address. |
| `apps/web/public/` | Public generated card/token/map artwork | You are checking what the browser can download. |

Local UI state includes zoom, inspected location, selected inventory tab, and an unconfirmed Travel route. Canonical state includes actual location, Health, inventory, and turn owner. The UI can predict which buttons look available; the engine must still validate the submitted action.

### Server

| File | What it owns |
| --- | --- |
| `apps/server/src/index.ts` | Starts the configured server. |
| `apps/server/src/app.config.ts` | Registers the `game` room and development HTTP routes/tools. |
| `apps/server/src/rooms/GameRoom.ts` | Connection-to-player identity, seat reclaim, command validation, randomness, content adapter, public/private state mapping. |
| `apps/server/src/rooms/schema/GameRoomState.ts` | Colyseus-synchronized public state classes. |
| `apps/server/src/private-condition-backs.ts` | Server-only reverse-side Condition transcripts and typed supported effects. |
| `apps/server/src/private-monster-spawn-effects.ts` | Converts supported printed Monster spawn abilities to typed operations. |
| `apps/server/private-card-assets/` | Reverse artwork that must not be placed in public web assets. |

The server currently permits up to four connected seats. Game start requires at least two players with the required lobby selections. The content includes reference information for more player counts; that does not mean the live room supports all of them.

### Engine

| File | What it owns |
| --- | --- |
| `packages/engine/src/index.ts` | State/content interfaces, command dispatcher, most integrated game transitions, decisions, encounters, Mythos, defeat, setup. |
| `skill-tests.ts` | Dice-pool arithmetic and success counting. |
| `combat.ts` | Framework-independent standard combat calculation. |
| `resources.ts` | Resource loss/recovery calculations. |
| `conditions.ts` | Condition threshold/conflict/front-ID helpers. |
| `omen.ts` | Omen track arithmetic. |
| `setup.ts` | Deck/pool construction and setup helpers. |
| `encounter-instructions.ts` | Supported executable encounter vocabulary, recursive parser, labels. |
| `research-instructions.ts` | Binds printed “this Clue” to the exact server-selected board marker. |
| `encounter-assets.ts` | Explicit non-combat possession preflight and Urban Guide's same-City aura; rejects unsupported branches before any roll. |

The large `index.ts` is a real maintainability limitation. Do not read it top-to-bottom first. Search for a symbol and inspect the small chain of helpers it calls. Splitting it into subsystem modules is useful future maintenance, but should preserve behavior and tests rather than become a prerequisite for every feature.

### Content and supporting directories

| Location | Purpose |
| --- | --- |
| `packages/content/src/map.ts` | Spaces, route types, adjacency and board-position information. |
| `investigators.ts` | Names, printed skills/resources, starting components, ability descriptions. |
| `assets.ts` / `assets.generated.ts` | Asset metadata plus the explicitly supported effect mappings. |
| `monsters.ts`, `gates.ts`, `clues.ts` | Component definitions and stable identities. |
| `location-encounter-rules.ts` | Structured mechanical text for the 108 location sections. |
| `research-encounter-rules.ts` | Structured Azathoth/Cthulhu Research sections. |
| `location-encounters.ts`, `token-encounters.ts`, `remaining-card-scans.json` | Artwork catalogs and explicit scan/crop mappings. |
| `mythos.ts`, `mysteries.ts`, `ancient-ones.ts` | Card/sheet data, typed instructions, and modeled dependencies. |
| `conditions.ts`, `spells.ts`, `artifacts.ts` | Physical-card catalogs and current mechanical metadata. |
| `readiness.ts` | Content readiness metadata; not proof of full rule execution. |
| `source-assets/` | Input scans and supplied source data. |
| `scripts/` | Repeatable transformations from source data/scans to generated assets/content. |
| `docs/rules/` | Source provenance, rule modeling, coverage, caveats. |
| `docs/exec-plans/base-game-rules-implementation.md` | Implementation history and remaining milestones. |

## 4. The five objects you should recognize

### Command: what the player asks to do

```ts
{ type: "TRAVEL", destinationIds: ["space_1"] }
```

`GameCommand` and `gameCommandSchema` live in `packages/protocol/src/index.ts`. Commands do not contain an authoritative actor `playerId`; the server derives that from the connection. A target player ID is different: it can identify the recipient of a legal trade or effect.

### State: what is true now

`GameState` in the engine contains players, phase, actions remaining, Doom/Omen, public components, private decks/pools, and interrupted resolutions.

Do not confuse `player.id` (the seat) with `player.investigatorId` (the currently selected investigator). Replacement changes the investigator, not the player's seat identity.

### Content: what components mean

`GameContent` is an engine-facing interface. The server builds `baseGameContent` by adapting the catalog. The engine does not import the whole content package itself.

This adapter matters: a field may exist in a content file but never reach the engine. For example, full Mystery setup/progress definitions currently do not reach live execution through the adapter—only deck identities and targets do.

### Context: where randomness comes from

`EngineContext` supplies `rollDie`, `shuffle`, `drawToken`, and `createId`. Production uses server-side randomness. Tests use `createDeterministicEngineContext` with explicit sequences.

```ts
const context = createDeterministicEngineContext({
  dice: [1, 6],
  ids: ["test-1", "choice-1"],
  tokenIndexes: [0],
});
```

The engine never needs `Math.random()`. Exhausted deterministic input usually means the test needs to supply another expected roll/ID, or the implementation unexpectedly consumes one.

### Result and events: what happened

Conceptually, a transition returns one of:

```ts
{ ok: true, state: nextState, events: [...] }
{ ok: false, error: { code: "WRONG_PHASE", message: "..." } }
```

Events record outcomes; they are not commands. The current room applies successful state but does not publish every returned domain event as a durable event log. Adding an engine event does not automatically make it visible in a browser log.

## 5. Trace a real feature: Rest

Use these symbols as a navigation exercise:

1. In `app.vue`, search `type: 'REST'`. The button calls `game.send`.
2. In `useGameRoom.ts`, find `send`. It attaches `expectedStateVersion` and sends the command.
3. In `GameRoom.ts`, find `handleCommand`. It calls `gameCommandMessageSchema.safeParse`, derives the actor from `playerIdBySession`, and checks the version.
4. It obtains ordinary engine state through `toEngineState`, then calls `executeCommand`.
5. In engine `index.ts`, search `command.type === "REST"`. Earlier dispatcher guards check phase, active player, pending choices, and action availability.
6. Rest checks repeated use and a Monster on the space, applies capped recovery and supported Rest bonuses, and may offer a Condition recovery choice.
7. Successful state goes through `applyEngineState` back into the public schema and private room fields.
8. Colyseus synchronizes the public changes; `syncState` in `useGameRoom.ts` updates reactive values and Vue redraws.

Notice what the button does **not** do: increment Health locally, consume an action locally, or send a desired dice result.

## 6. Why choices do not resolve in one function call

Acquiring Assets, rerolling dice, and printed encounter choices require another player input. A function cannot simply wait for a browser inside the pure engine.

Instead it stores a **continuation**: data describing the unfinished operation.

```text
Begin test → roll dice → offer private decision
                           ↓
                save pending state; return
                           ↓
RESOLVE_DECISION → validate owner/selection → reroll or keep
                           ↓
                resume the original operation
```

Useful fields/symbols:

- `activeTest`: skill, dice, successes, owner, and the continuation category.
- `pendingDecision`: question, legal option IDs, selection bounds, and owner.
- `pendingLocationEncounter`: remaining instruction queue, card/deck, previous result.
- `continueLocationEncounter`: expands and executes nodes until completion or a decision.
- `RESOLVE_DECISION` inside `executeCommand`: validates and resumes.

These are data, not closures. They survive JSON round trips and can be delivered again after reconnect. A pause must not cycle the card or advance the encounter prematurely.

The room stores the full decision privately. Other clients receive a public summary, not owner-only option identities. `sendPendingDecision` supplies the owner with the actual choices.

## 7. Card text, instructions, and execution are different

A scanned image is not executable. A text description is not executable. Even a typed instruction can still be unsupported.

The progression is:

```text
Scan → artwork/catalog → mechanical transcription
     → validated instruction → engine handler → room/UI flow → tests
```

The runtime does not read printed English or `effectText` and guess what to do.

For example, a simple encounter instruction has this shape:

```ts
{
  kind: "test",
  skill: "observation",
  modifier: -1,
  pass: { kind: "effects", effects: [{ kind: "clues", amount: 1 }] },
  fail: { kind: "effects", effects: [{ kind: "sanity", amount: -1 }] },
}
```

The parser accepts only supported nodes. The interpreter performs the rule. Research has an extra binding step: printed “this Clue” becomes collection of a specific opaque board marker rather than a generic reward from supply.

**Unsupported branches reject the whole section before its first effect.** A card is not safe merely because today's roll might avoid the unsupported branch.

Recent example: Star Spawn support mostly extended the accepted ambush IDs. The shared Will/Strength continuation already existed from Deep One work. Tests verified printed stats, exact outcomes, and token preservation; the card transcription was already present. This is an example of a small vertical slice rather than a rewrite.

## 8. Public state, private state, and physical identities

| Example | Visible to everyone? | Where it belongs |
| --- | --- | --- |
| Investigator location/Health | Yes | Public synchronized state. |
| Revealed card identity | Yes | Public synchronized state. |
| Undrawn deck order | No | `privateState.deckOrderById`. |
| Monster cup / physical Clue supply | No | `privateState.tokenPoolById`. |
| Full pending instruction queue | No | Private room continuation. |
| Owner-only choice options | Owner only | Private decision message. |
| Hidden Condition reverse identity | No | Private physical identities/back mapping. |

An opaque Clue marker ID is not its underlying physical token identity. A Monster instance ID is not its Monster type ID. A named ambush references the Monster's attributes; it does not damage an existing board instance or remove a named token from the cup.

Some public schema collections are comma-separated IDs or JSON strings. `toEngineState`, `applyEngineState`, and frontend `syncState` encode/decode them. This is an implementation compromise, not three separate authorities.

When adding state, classify it first. A public field generally requires engine state, schema, both server mappings, and frontend decoding. A private field must remain out of the public schema and have a serialization/ownership test.

## 9. What is done—and what is not

The following snapshot distinguishes working slices from complete families:

| Area | Implemented | Important limitation |
| --- | --- | --- |
| Multiplayer | Room create/join, validated commands, version checks, dropped-seat recovery, private choices | In-memory only; no durable server-restart recovery. |
| Setup | AO/investigator selection, starting Assets/Clues, Reserve, private decks, initial Gates/Monsters/Clues | Starting Spells, some setup choices, Expedition/Mystery entry effects incomplete. |
| Actions | Travel/tickets, Rest, Acquire Assets, accepted trades, action usage, Delay, selected component actions | Investigator abilities and possession actions incomplete. |
| Tests | Dice arithmetic, improvements, thresholds, highest Item bonus primitive, owner-only Clue rerolls | The arithmetic primitive does not mean every possession bonus is integrated. |
| Combat | Basic printed-stat combat and phase ordering; Deep One/Star Spawn Research ambush continuation | Board-combat rerolls, Cultists, special abilities and possession effects incomplete. |
| Location | All 36 cards transcribed; 64/108 sections accepted by the parser; sixteen Assets have verified non-combat applicability | Remaining 44 unsupported; other carried Assets still block live resolution. |
| Research | All 24 Azathoth and 18/24 Cthulhu sections supported; ten-Asset non-combat scope | Other Asset and ambush guards; remaining Cthulhu rewards/Cultists; Shub/Yog transcription/execution. |
| Mythos | All 51 icon sequences cataloged; 17 printed texts have typed effects | Remaining 34 texts and broad Reckoning can stop the round. |
| Conditions | Physical copies, several actions/conflicts, thresholds, five typed reverse handlers | Most reverses and full trigger sequencing incomplete. |
| Assets | 40-card catalog; five mappings with supported partial/full effects, plus explicit encounter applicability | Most effects remain display-only or guarded; Urban Guide is wired only into non-combat location/Research. |
| Spells | 20 physical cards / 10 types with paired artwork | Live casting and back execution absent. |
| Artifacts | 14-card supply/holdings; T'tka Halot gain/action | Other executable effects/gains incomplete. |
| Other World/Expedition/Special | Artwork/catalogs imported | Complex resolution and live family handlers absent. |
| Mysteries | 16 structured cards; generic progress/replacement/victory helper | No live gameplay calls the progress helper; printed completion timing and setup need wiring. |
| Awakening | Azathoth zero-Doom loss | Other AO transitions/Final Mysteries guarded. |

This is an implemented multiplayer foundation with substantial rule slices, **not a finished base-game simulator**. A healthy build or many passing tests does not imply all randomly reachable cards execute.

## 10. Start and inspect the project locally

From the repository root:

```sh
pnpm install
pnpm dev
```

Default web address is `http://localhost:3000`; default game-server address is `http://localhost:2567`. `PORT` can change the server port, and `NUXT_PUBLIC_COLYSEUS_URL` changes the browser's target. Keep them consistent. Check the actual startup output rather than assuming a port.

To run the two processes separately:

```sh
pnpm --filter server dev
```

In another terminal:

```sh
pnpm --filter web dev
```

Use a second browser/incognito session to create a genuinely independent player. Local storage holds reconnection and per-room seat tokens; do not paste those into logs or commit them. The default local server URL is not a deployed multiplayer service.

If startup fails, first check `node --version`, `pnpm --version`, environment configuration, and startup logs. The server declares Node >=22; use a version also compatible with the installed Nuxt version. Inspect installed packages before borrowing framework APIs from examples.

## 11. Tests: your safest way into the rules

| Test directory | What failures usually mean |
| --- | --- |
| `packages/engine/test` | Rule legality, arithmetic, continuation, conservation, or phase behavior changed. |
| `packages/content/test` | Component counts/IDs, source mapping, typed transcription, artwork, or schema changed. |
| `packages/protocol/test` | Command/decision validation contract changed. |
| `apps/server/test` | Room ownership, synchronization, hidden information, or reconnection broke. |
| `tests/e2e` | Actual browser flow broke. |

Useful commands:

```sh
pnpm --filter @eldritch/engine exec vitest run test/skill-tests.test.ts
pnpm --filter @eldritch/engine exec vitest run test/cthulhu-research.test.ts
pnpm --filter server test
pnpm content:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Current `lint` scripts primarily run TypeScript/Nuxt checks; they are not a broad stylistic ESLint suite. The web package's `test` script is also typechecking, not Vue behavioral tests. The browser smoke test covers two clients, Acquire Assets and Travel—not a complete session.

The scoped encounter-Asset implementation run passed 332 engine tests and 47 server tests. Those are a dated baseline, not checks rerun automatically by reading this guide.

## 12. Your first exercise: add a small test

Open `packages/engine/src/skill-tests.ts`, then `packages/engine/test/skill-tests.test.ts`. Add this case inside the success-counting describe block:

```ts
it("distinguishes Blessed, normal, and Cursed thresholds", () => {
  const dice = [3, 4, 5, 6];
  expect(countTestSuccesses(dice, 4)).toBe(3);
  expect(countTestSuccesses(dice, 5)).toBe(2);
  expect(countTestSuccesses(dice, 6)).toBe(1);
});
```

Run the focused test command above. Before running, predict every result. Temporarily make one expectation wrong, observe the failure, then restore it. You have now edited executable project behavior checks without needing a running server.

This example tests the counting primitive. It does not prove every engine caller applies Condition thresholds correctly; those integration tests belong in the calling subsystem.

## 13. Your second exercise: understand Rest without changing the rules

1. Locate an existing Rest case in `packages/engine/test/engine.test.ts`.
2. Duplicate the fixture into a new clearly named case, not the whole test file.
3. Test that Rest at maximum Health/Sanity does not exceed the maximum.
4. Add a Monster on the investigator's space and expect `REST_BLOCKED_BY_MONSTER`.
5. Assert that the input state is unchanged after the rejected transition.

You are learning how state fixtures, commands and errors fit together. Do not create a fresh full game via `START_GAME` for every small test: existing fixtures deliberately isolate the subsystem and avoid irrelevant shuffle inputs.

## 14. How to implement a feature yourself

### Case A: presentation-only change

Example: make an inventory label clearer.

Edit the relevant Vue template/style, keep canonical state untouched, typecheck, and inspect the actual layout. No new engine command is needed.

### Case B: card uses existing supported instructions

Verify the source, add/correct the structured instruction, validate it, and add success/failure tests. Confirm the entire card branch is supported and reaches the live content adapter. Usually no new protocol command is needed.

### Case C: genuinely new rule operation

Work through this checklist:

1. Define the printed rule and timing from a verified source.
2. Identify existing helpers to reuse; do not parse English text at runtime.
3. Add a bounded typed operation and its validation.
4. Add the engine transition: legality checks first, then cloned state changes.
5. If a choice is required, store a serializable continuation and owner-only legal options.
6. Add protocol changes only if a new player intent or decision category is actually needed.
7. Connect live content in `GameRoom.ts` if new data is required.
8. Round-trip added state through private/public mappings appropriately.
9. Add the UI control only after the server can execute it.
10. Test success, refusal/failure, illegal timing, ownership, conservation, defeat and serialization as applicable.
11. Update the coverage document; run checks; review and commit the scoped diff.

An exported helper alone is not a finished feature. Ask: **what live command/effect calls it?** Likewise, a new schema field does not finish synchronization until both mapping directions and the client decoding agree.

## 15. Debugging: locate the layer before changing code

| Symptom | Start here | Check |
| --- | --- | --- |
| “Failed to fetch” while creating a room | Server terminal, `nuxt.config.ts`, `useGameRoom.ts` | Server running, correct port/URL, reachable address. |
| `INVALID_COMMAND` | Protocol schema, `handleCommand` | Wrong fields, invalid IDs, strict-schema rejection. |
| `STALE_STATE` | Client `send`, room version check | A command was built against an older synchronized state. Review and retry; do not remove the guard. |
| `NOT_ACTIVE_PLAYER` / `WRONG_PHASE` | `executeCommand` | Turn, phase, pending decision, defeat, action budget. |
| `ENCOUNTER_UNSUPPORTED` | Parser/binder and possession guards | Unsupported branch or carried Asset, not necessarily missing scans. |
| `MONSTER_EFFECT_UNSUPPORTED` | Combat/ambush checks | Special text, Cultist stats, or possession effects. |
| `RECKONING_UNSUPPORTED` | `resolveMythosReckoning` | A category or trigger is not integrated. |
| Choice works but vanishes after reconnect | Room private fields and mappings | Continuation was not retained or owner options were not resent. |
| Engine test passes but UI stays unchanged | `applyEngineState` → schema → `syncState` | Missing mapping or wrong serialized format. |
| Artwork exists but rule stops | Content versus engine coverage | Import is not implementation. |

Use `rg` to find symbols:

```sh
rg -n 'command.type === "REST"' packages/engine/src/index.ts
rg -n 'REST_BLOCKED_BY_MONSTER' packages apps
rg -n 'monster_star_spawn' packages apps/server
rg -n 'applyMysteryProgress' packages/engine/src apps/server/src
```

Put breakpoints at `handleCommand`, `executeCommand`, the target handler, and `applyEngineState`. For temporary logs, record command type, phase, error code and state version—not seat tokens, hidden deck order, or unrevealed reverse identities. Remove debugging logs before committing.

## 16. Source assets and generated files

Source scans and supplied JSON live under `source-assets`. Generators write browser/server artwork and some normalized content. Prefer editing the source/mapping and rerunning the relevant generator over hand-editing generated output.

Root scripts include `assets:data`, `assets:generate`, `encounters:generate`, `remaining-cards:generate`, `conditions:generate`, `spells:generate`, `map:generate`, and token/Mystery/Mythos generators. Check the script's inputs/output paths before running it: generation can change many files.

Do not make a hidden Spell/Condition reverse public just to fix an image display problem. Separate image availability from permission to reveal a particular drawn card's hidden side.

Stable IDs connect catalogs, state, rules and artwork. Rename one only with an explicit reference migration and tests. Display titles can change without changing identity.

## 17. What to read in order

### First session: basic arithmetic and one command

1. This guide, sections 1–5.
2. `skill-tests.ts` and its tests.
3. Rest's UI call, protocol shape, room handler, and engine branch.

Goal: explain why the UI cannot grant itself Health.

### Second session: state and interruptions

1. Engine `GameState`, `PrivateGameState`, `EngineContext`, `CommandResult`.
2. `toEngineState` and `applyEngineState` in the room.
3. One Acquire Assets or encounter reroll test.

Goal: explain what persists while a choice is pending and what the other player can see.

### Third session: one real card

1. Cthulhu card 5 Sea in `research-encounter-rules.ts`.
2. `bindResearchInstruction` and `continueLocationEncounter`.
3. Star Spawn cases in `cthulhu-research.test.ts`.
4. The matching serialized-room test in `GameRoom.test.ts`.

Goal: explain why victory retreats Doom but does not collect the failed Research Clue, and why no physical Star Spawn token changes.

### Fourth session: your first owned change

Add a regression test or a presentation-only improvement. Keep the scope small enough that you can describe every changed line. Then move to a source-verified rule operation.

## 18. Documentation caveats and ownership habits

Some existing documents are historical snapshots. The old multiplayer vertical-slice document, package starter READMEs, readiness notes, and the September PDF generator describe earlier coverage. Do not treat their “not yet implemented” statements as a current runtime audit. Consult current code, focused tests, and the latest entries in the rules implementation plan together.

`CODEX.md` defines engineering boundaries, not the complete current command list; some snippets are illustrative. The protocol schema is the actual accepted network contract.

Good ownership questions before merging any change:

- Which layer owns this decision?
- What input is trusted, and what is validated?
- Can I explain the transition using before-state → command → after-state?
- Is hidden information still private?
- What happens if the investigator is defeated halfway through?
- Which test would fail if this feature were removed?
- Is the feature wired into live play or only exposed as a helper?
- Which limitations remain intentionally guarded?

Before editing, run `git status --short`. Untracked scans and unrelated modifications belong to the existing workspace; do not stage them incidentally. Review `git diff`, add only the intended files, and commit one meaningful change with a description of its behavior. Never commit seat tokens or `.env` secrets. If you want a separate working branch, use a descriptive `codex/` branch name under this repository's convention.

You can ask for future work in a learning mode: “Explain the files and tests first; let me implement the handler; review my diff afterward.” You do not need to delegate the implementation itself to get help.

## 19. Where to go next

- Engineering boundaries: [CODEX.md](/Users/alenichshanov/Desktop/personal/eldritch-horror-vue/CODEX.md).
- Rules progress/history: [implementation plan](/Users/alenichshanov/Desktop/personal/eldritch-horror-vue/docs/exec-plans/base-game-rules-implementation.md).
- Current Research/Artifact slices: [encounter coverage](/Users/alenichshanov/Desktop/personal/eldritch-horror-vue/docs/rules/base-game-token-encounters-and-artifacts.md).
- Your first small module: [skill-tests.ts](/Users/alenichshanov/Desktop/personal/eldritch-horror-vue/packages/engine/src/skill-tests.ts).
- Your first test file: [skill-tests.test.ts](/Users/alenichshanov/Desktop/personal/eldritch-horror-vue/packages/engine/test/skill-tests.test.ts).
- Connection adapter: [useGameRoom.ts](/Users/alenichshanov/Desktop/personal/eldritch-horror-vue/apps/web/app/composables/useGameRoom.ts).
- Server boundary: [GameRoom.ts](/Users/alenichshanov/Desktop/personal/eldritch-horror-vue/apps/server/src/rooms/GameRoom.ts).

Start with the threshold exercise. When you can predict the result and explain why the test passes, you already own a small, real part of this project.

## 20. A small real change to study: possession-aware encounters

The next implemented slice after this guide is a useful example of the ownership boundaries:

1. `assets.ts` records `nonCombatEncounterSupport` for eight visually verified cards. Seven have no effect in this context; Urban Guide has a typed City aura. An empty effect list is never used as evidence that a card is harmless.
2. `encounter-assets.ts` checks every branch, including unchosen failure branches, for unsupported possession effects. It calculates Urban Guide's additional die from living same-City holders, including a different player.
3. Engine `index.ts` invokes that preflight before drawing/rolling, and passes the aura into `calculateDicePool` as a non-Item bonus.
4. `GameRoom.ts` supplies the new content metadata. No new network command is needed because the player still requests an ordinary encounter or Research.
5. `encounter-assets.test.ts` covers both encounter families, metadata guards, dice, failure branches, token conservation and private rerolls. The room regression checks the actual content adapter and serialized decision.

The scope is deliberately narrow: ambush combat with possessions/local auras and other Assets are still guarded. Item-discard choices were implemented in the next slice (section 22). For example, a held .45 Automatic no longer blocks an ordinary Research section, but it does not yet enable an ambush branch that needs its combat bonus. This is why explicit context support is different from “this card is completely implemented.”

## 21. Follow the next change: an optional Asset reroll

Personal Assistant is now the ninth supported non-combat Asset. Read its two typed nodes in `packages/content/src/assets.ts`: `skill_bonus` adds one Influence die, and `test_reroll` grants an optional reroll for that skill. No runtime code parses the printed text.

In engine `index.ts`, `createTestRerollDecision` builds the source-specific options. `die-0` means spend one physical Clue to reroll the first die; `asset-reroll:asset_personal_assistant:0` means use the free Asset source. Both enter the existing `RESOLVE_DECISION` command. The engine rechecks ownership, held source, matching skill, index and prior usage before changing dice. It only consumes a Clue for the Clue option.

`ActiveTest.usedRerollAssetIds`, defined in `packages/protocol/src/index.ts`, is an optional array so old states still behave as having no consumed sources. Each free use adds its physical source ID. The room retains the canonical test, and JSON restoration preserves that array; the public schema does not need it to decide outcomes. After a reroll, the engine offers remaining sources or resumes the encounter/Acquire Assets continuation. Keeping the result skips the remaining optional rerolls. A new test has a fresh usage list.

The web dialog in `apps/web/app/app.vue` displays rolled dice separately from labeled source choices and sends the selected option ID; it never rolls a die or consumes resources itself. Study `encounter-assets.test.ts` for deterministic source-order cases, `GameRoom.test.ts` for actual connection authorization/restoration, and `tests/e2e/multiplayer.spec.ts` for Charlie Kane's free-reroll click path.

Verification for this slice passed lint, typecheck, build, 337 engine tests, 48 server tests, 77 content tests, 18 protocol tests and both browser journeys. Other World, possession-aware combat/ambush and other Asset reactions remain outside this slice. Its planned Item-discard follow-up is described next.

## 22. Follow a physical card through an encounter discard

Cthulhu Research 3 City and 6 Wilderness failure instructions contain `discard_item_assets` with amounts one and two. They now run with eligible held Items instead of rejecting the encounter. No new scan import or network command is involved.

Start in `packages/engine/src/encounter-assets.ts`: `encounterItemAssetIds` reads structured Item traits, while `encounterItemsAreConserved` counts each eligible ID across player holdings, defeated sheets, Reserve, private deck and discard. An eligible card must appear exactly once. The preflight checks all outcome branches before rolling, including a failure branch that may not ultimately execute. Unsupported card effects still block entry.

Then read `continueLocationEncounter` in engine `index.ts`. At a discard instruction it asks the owner to choose one Item; there is no refusal option. `RESOLVE_DECISION` rechecks that the selected physical card is still held and unique, moves it to `assetDiscardIds`, emits an encounter-reason discard event, and decrements the remaining count. The second choice cannot offer the already discarded card. With fewer Items than required, it discards what exists and continues. Allies remain in inventory.

The card 6 queue runs discards **before** nearest-Sea movement. While paused, the encounter deck and Clue marker are unchanged; after all choices finish, the exact marker moves without changing its private token ID, the card cycles once, and the next investigator receives the encounter turn. JSON restoration preserves the remaining count and completed physical transfers.

`apps/web/app/components/EncounterChoicePanel.vue` already displays server-labeled single choices; it needs no Item-specific rules. Study the discard cases in `encounter-assets.test.ts` and the room's successive-discard regression to follow ownership, failed forged choices, serialization and conservation. Verification passed lint/typecheck/build, 349 engine tests, 49 server tests, 77 content tests, 18 protocol tests and both existing browser journeys (not a dedicated Item-discard browser journey). The Lucky Rabbit's Foot follow-up is described next; combat bonuses and other unverified Asset reactions remain guarded.

## 23. Test usage is not round usage

Lucky Rabbit's Foot illustrates why rules need explicit timing, not just a reroll button. Its scan allows one die to be rerolled during any test **once per round**. Personal Assistant is limited to Influence, but can be used on each new Influence test. Neither costs a Clue.

In `packages/content/src/assets.ts`, the Foot has a distinct `round_test_reroll` node. Engine `canUseAssetTestReroll` reads typed nodes, the current skill, the held physical ID and both usage lists. `ActiveTest.usedRerollAssetIds` ends with the current test; `GameState.usedAssetRerollIds` survives until `BEGIN_NEXT_ROUND`. A Foot use adds its ID to both; an Assistant use adds it only to the test list. Declining adds nothing. The Foot adds no skill dice and does not change the current Blessed/Cursed threshold.

The round list uses the physical Asset ID, not the owner's ID. Transferring the card cannot grant another use in the same round. Both lists survive JSON restoration. Public projections clone the new list, and `GameRoomState.ts` stores it as a string following the existing per-round action lists; `GameRoom.ts` splits/joins it at the engine boundary. The browser receives source-specific labels from the server and still sends only `RESOLVE_DECISION`.

The Foot's only printed trait is Trinket. A convenient everyday assumption that a trinket is an Item would incorrectly discard it during Research; the engine uses the actual structured traits. `encounter-assets.test.ts` explicitly tests that exclusion along with all five skills, Research, source orders and the next-round reset. The room regression checks actual serialization, and the Lily browser journey clicks the no-Clue option. This slice supports ordinary location/Research and already-supported generic tests such as Acquire Assets, not combat/Other World. Next: Hired Muscle's Strength bonus and optional reroll.

Verification passed root lint/typecheck/test/build: 364 engine, 50 server, 77 content and 18 protocol cases. All three browser journeys passed, then passed three repetitions each. Lily legally travels to Tokyo if the starting Monster occupies Shanghai; the test does not bypass the rule that blocks Acquire Assets on a Monster space.

## 24. Add a card by reusing typed rules

Hired Muscle is a small example you can follow without learning a new command. Its verified scan says Ally, +1 Strength and an optional Strength-test reroll. In `packages/content/src/assets.ts`, its two nodes reuse Personal Assistant's `skill_bonus` and `test_reroll`, now allowing Strength. The matching union in engine `index.ts` is widened too. The existing handlers already compare the test's skill with the node's skill, so no special `if (cardName === ...)` handler is needed.

`continueLocationEncounter` and `beginSkillTest` add the holder's bonus to non-Item dice. `canUseAssetTestReroll` and `createTestRerollDecision` offer the physical source only during Strength tests. `RESOLVE_DECISION` checks ownership and previous usage. The server's existing content adapter delivers these nodes; the existing browser dialog displays the card-specific label. Hired Muscle consumes only the test-local counter, not the Foot's round counter.

Study the Hired Muscle cases in `packages/engine/test/encounter-assets.test.ts` and the General 10 Sea regression in `apps/server/test/GameRoom.test.ts`. They show bonus stacking, unrelated-skill exclusions, a generic Condition Reckoning test, source interactions, restoration and illegal selections. Being an Ally matters for both non-Item bonus stacking and exclusion from Item discards. Combat/ambush and Other World remain unsupported; adding a node is not a claim that every context is wired.

Next: Bandages needs a different pattern, because optional damage prevention must pause before Health loss and defeat. The plan starts with ordinary encounter damage and explicitly keeps other damage contexts guarded.

Verification for Hired Muscle passed lint/typecheck/test/build with 376 engine, 51 server, 77 content and 18 protocol cases, plus all three existing browser journeys. The room regression is Hired Muscle-specific; the browser journeys are shared reroll UI regressions, not dedicated Hired Muscle coverage.

## 25. Pause before damage, not after defeat

Bandages differs from a dice bonus: the player decides before Health is lost. Its typed content node in `packages/content/src/assets.ts` enables only ordinary encounter Health prevention. `encounterDamagePreventions` in engine `encounter-assets.ts` locates living holders on the injured investigator's space; `physicalAssetIsUnique` rejects duplicate cards across physical piles.

In engine `continueLocationEncounter`, adjacent Health/Sanity losses become an internal `damage_reaction` node. The damage amounts and declined-holder list stay in the private encounter queue, which is already cloned and restored by the room. The choice is assigned to the card holder, not necessarily the encounter investigator. The existing `RESOLVE_DECISION` handler rechecks eligibility, discards the physical Asset if accepted, and lowers only the pending Health amount. Then the original investigator takes remaining Health and Sanity loss simultaneously, before later instructions or defeat handoff.

The existing browser `EncounterChoicePanel.vue` shows the server's labels and sends one option ID. It neither calculates prevention nor decides defeat. No new wire command or public state field is needed. The printed-content parser rejects `damage_reaction`: it is runtime state, not a card instruction supplied by a client or imported scan.

Read `packages/engine/test/encounter-prevention.test.ts` for one/two prevention, decline, colleague privacy, repeat losses, lethal/Sanity boundaries, restoration and invalid sources. The room regression uses a real Azathoth Research card and two connections. Ordinary location/Research damage is supported; paid Health costs and ambush contexts remain guarded, and other damage handlers are not integrated. Next: Whiskey's same-space Sanity-loss prevention from its existing scan.

Verification passed lint/typecheck/test/build with 405 engine, 52 server, 77 content and 18 protocol cases. All three existing browser journeys passed three repetitions each. They are shared UI regressions, not a dedicated Bandages journey. The Bandages-specific room test verifies the real owner-private decision path.

## 26. Two cards, one simultaneous damage checkpoint

Whiskey now uses the same ordinary location/Research checkpoint as Bandages, but reduces Sanity instead of Health. Content owns `discard_prevent_sanity_loss`; engine `encounterDamagePreventions` returns the holder, physical card, amount and resource. The server and browser keep using the existing owner-private decision command and display labels.

The important distinction is a decline belongs to a card, not its holder. `damage_reaction.declinedAssetIds` prevents the same card being offered twice for this loss without suppressing another held card. `declinedPlayerIds` remains for older checkpoint compatibility; new checkpoints leave it empty. The resolver checks the actual offered ID against current holdings and conservation even on decline. If the card vanished, it rejects instead of switching to another source.

With both losses pending, accepting Bandages does not immediately apply Sanity damage. Whiskey is offered next, potentially to another same-space holder, and only then are remaining losses applied simultaneously to the original investigator. A lethal remainder interrupts later rewards; the encounter card cycles once. Preventing one still discards the whole card, and neither prevention heals. A later distinct loss starts a fresh decline list.

Study the combined-source cases in `packages/engine/test/encounter-prevention.test.ts`: reverse card order or decline the first source and follow the remaining choice. The paired real Research room tests in `apps/server/test/GameRoom.test.ts` verify colleague ownership, private restoration and damage before defeat. Ordinary encounters only are integrated: paid matching-resource costs and ambushes remain guarded; Mythos/Condition/combat/Other World timing is still separate work. Next: Lucky Cigarette Case's optional once-per-round +1 to one test die result (not a reroll), using its verified existing scan.

Verification passed lint/typecheck/test/build: 432 engine, 53 server, 77 content and 18 protocol cases. Three existing browser journeys passed three repetitions each; these exercise shared UI, not dedicated Whiskey scenarios. Charlie's browser fixture now legally Travels away if random setup places a Monster in his starting City, rather than assuming Acquire Assets is always available there.

## 27. Changing a die result without rerolling

Lucky Cigarette Case uses a new content node, `round_test_die_increment`, not the Foot's reroll node. It is a Trinket. In engine `createTestRerollDecision`, a held, unique, unused physical source adds `asset-increment:<ID>:<index>` options alongside Clue/Asset rerolls. The existing decision kind and continuation names remain `select_rerolls`/`test_reroll` for compatibility; their actual options now describe different test die effects.

In `RESOLVE_DECISION`, the increment path validates the source and die, records `usedAssetDieModifierIds`, adds exactly one and recounts successes without calling `rollDie` or paying a Clue. The changed result replaces the old value: a five becomes six for Fine Clothes; rerolling it afterward replaces six with the newly rolled value and does not preserve the +1. Options for this source disappear for the rest of the round, even after ownership changes. The Foot's usage is independent, so either source order works. Declining preserves unused availability.

`GameRoomState.ts` and `GameRoom.ts` round-trip the public used-source list; the private decision carries legal choices only to its owner. `app.vue` shows “Use selected die modifier” for increment options and keeps the existing reroll label for rerolls. No client chooses the resulting value, success count, usage or randomness. Public projections copy the new array rather than exposing a mutable canonical reference.

Read `packages/engine/test/encounter-die-modifier.test.ts` for the pure engine cases and the first room regression in `apps/server/test/GameRoom.test.ts` for real connections/restoration. The supported target values are 1–5, not above-six results. Generic tests, ordinary location and Research are integrated; fixed dice rolls, combat/ambush and Other World are not. Next: Witch Doctor's same-space Rest choice using the existing scan.

Verification passed lint/typecheck/test/build with 454 engine, 54 server, 77 content and 18 protocol cases (603 total), plus all three existing browser journeys. Modifier-specific coverage is at engine/room level; a dedicated browser modifier scenario remains useful future work.

## 28. Completing one action across several choices

Witch Doctor lives in the Asset content layer as `rest_health_or_discard_cursed`. It is an Ally, not an Item. Its Rest-only effect is explicitly irrelevant to ordinary location/Research tests, bringing that applicability roster to fifteen. The engine never reads the card's English text to decide what to do.

Follow the `REST` branch in `packages/engine/src/index.ts`: first ordinary capped recovery (including Bible), then optional Injury/Madness rolls, then `finishRest`. That helper looks for an eligible living same-space holder and offers the resting player a private `rest_asset_choice`. Without an Ally it completes Rest immediately. With one it defers `completeAction` until the player accepts Health recovery, discards Cursed, or skips. This is why several decisions still cost only one action.

The `witch_doctor_rest` continuation rechecks the exact offered source and conservation after JSON restoration. Additional Health uses `recoverResource` and emits `INVESTIGATOR_RECOVERED`, not another Rest action. Cursed uses `returnConditionToPool`; the physical ID stays private and the public event says `condition_cursed`. The Ally remains held and can help another investigator's later Rest. The server delivers choices only to the resting player; `EncounterChoicePanel.vue` displays them under “Rest bonus” and sends the existing runtime-validated decision command.

Read `packages/engine/test/rest-assets.test.ts` for the small complete flow and the two Witch Doctor cases in `apps/server/test/GameRoom.test.ts` for real clients. To add another Rest trigger, preserve this deferred completion boundary: never charge a second action or let a client pick authoritative outcomes. Next: Puzzle Box's optional Observation test and conserved Artifact reward, starting with its existing scan verification. Full Rest-trigger ordering, combat/Other World and remaining possession effects still need work.

Verification passed root lint/typecheck/test/build with 478 engine, 56 server, 77 content and 18 protocol cases (629 total). Three existing browser journeys passed. Witch Doctor-specific coverage is in engine/room tests; a dedicated browser scenario remains future work.

## 29. A test nested inside a Rest action

Puzzle Box is a Trinket with `rest_test_gain_artifact` in Asset content. Its holder can opt into an Observation −2 test during Rest; a pass discards the Box and gains one Artifact. The engine's `finishRest` now presents all remaining eligible Rest sources together, so Witch Doctor can remove Cursed before the test or resolve afterward. Each source is offered until resolved/skipped, never twice in the same Rest.

`GameState.pendingRest` stores the actor, `remainingAssetIds` and `testingAssetId`. It is canonical but private, like `pendingLocationEncounter`: explicitly excluded from public projection and deep-copied during command transitions. `GameRoom.ts` keeps it as a private room field and includes it in internal snapshots, not synchronized Schema. Missing checkpoints on older Witch Doctor decisions have a narrow compatibility path.

Accepting the Box preflights its exact holding, other test possessions, remaining sources and the physical Artifact supply, then calls `beginSkillTest` with `rest_asset`. The shared test engine handles improvements, minimum dice, same-City Urban Guide, thresholds, Clue rerolls and supported Asset die effects. Every resumed reroll repeats the preflight before spending a Clue. `finishSkillTest` discards/draws only after the final successful result; failure keeps the Box. It removes the resolved source and calls `prepareRestContinuation` again, rather than completing a component action. Only an empty remaining list calls `completeAction("rest")`.

Internally `prepareRestContinuation` mutates only the cloned working state and events; it does not advance `stateVersion`. `finishRest` wraps it for top-level Rest commands, while `finishSkillTest` calls it directly. This prevents a nested continuation from advancing the version twice: every accepted command still increments once, regardless of how many effects it resolves.

The draw is the shuffled deck's top, not a chosen Artifact or a search. Currently only T'tka Halot has an executable handler; another top Artifact causes an explicit error before the test, without dice/card consumption or naming the hidden card. “Skip Puzzle Box” remains available. This guard is a real remaining gameplay limitation, not missing artwork. A valid depleted supply yields no reward and still discards a successfully opened Box.

Read `packages/engine/test/puzzle-box.test.ts` for pure flow/guards and the two Puzzle Box cases in `apps/server/test/GameRoom.test.ts` for real owner messages and restoration at both the test and remaining-bonus checkpoints. Next: scan-check Cultes des Goules and implement its Lore/Sanity-for-two-Clues action, then deliberately extend allowed Artifact gains. No new scans are required. Puzzle Box is not fully playable against every possible Artifact draw yet.

Verification passed root lint/typecheck/test/build: 506 engine, 58 server, 77 content and 18 protocol cases (659 total). Three existing browser journeys passed; Puzzle Box-specific coverage is at engine/room level. Every accepted command advances the state version once, including nested Rest-test completion.
