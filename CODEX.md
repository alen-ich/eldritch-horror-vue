# Eldritch Horror Web — Codex Working Guide

This file is the detailed engineering guide for AI-assisted work in this repository.
Codex should read the root `AGENTS.md` first, then this file before making non-trivial changes.

## 1. Project Mission

Build a browser-based, multiplayer implementation of Eldritch Horror with an authoritative server, reconnectable game rooms, deterministic rule execution, structured game content, and a Vue/Nuxt user interface.

The main engineering priority is correctness of game rules and multiplayer state, not visual polish.

## 2. Architectural Principles

1. The server is authoritative. Clients send intentions/commands; clients do not directly mutate canonical game state.
2. The rules engine is framework-independent pure TypeScript.
3. Keep UI state separate from game state.
4. Game content is data. Cards, investigators, monsters, encounters, mysteries, and other content should be represented as structured data whenever practical.
5. Hidden information must remain server-side. Do not synchronize deck order or unrevealed information to clients that should not know it.
6. Prefer deterministic transitions: `state + command + RNG input -> result/events/new state`.
7. All important rule behavior needs automated tests.
8. Keep the initial system a modular monolith. Do not introduce microservices, Kafka, Kubernetes, GraphQL, or Redis without a demonstrated need.
9. Avoid premature abstractions. Implement the smallest complete vertical slice first.
10. Preserve multiplayer reconnection and room isolation as first-class requirements.

## 3. Target Stack

- Runtime: Node.js active LTS, minimum compatible with current Nuxt 4 requirements.
- Package manager: pnpm.
- Monorepo task runner: Turborepo.
- Language: TypeScript with strict mode.
- Frontend: Nuxt 4 + Vue 3.
- Frontend local/UI state: Pinia where useful; never as the authoritative game state.
- Board rendering: Vue + SVG initially. Introduce PixiJS only if profiling proves SVG insufficient.
- Multiplayer server: Colyseus, using its current installed API.
- Multiplayer transport: WebSockets through Colyseus.
- Rules engine: pure TypeScript package with no Vue, Nuxt, DOM, Colyseus, database, or network imports.
- Persistence: PostgreSQL when persistent games/accounts are introduced.
- ORM: Prisma unless an architectural decision record explicitly replaces it.
- Unit tests: Vitest.
- Browser/E2E tests: Playwright.
- Deployment: Docker-compatible services.

## 4. Repository Layout

Expected direction:

```text
apps/
  web/                  # Nuxt client
  server/               # Colyseus authoritative multiplayer server

packages/
  engine/               # Pure Eldritch Horror rules engine
  protocol/             # Commands, events, IDs, wire/public types
  content/              # Structured game content and validators
  shared/               # Truly generic shared helpers only

assets/                  # Source/static game assets if legally usable
scripts/                 # Data conversion, validation and development tooling
docs/
  architecture/          # Architecture decisions and system documentation
  rules/                 # Rule modeling notes / implementation status
  exec-plans/            # Larger implementation plans
```

Do not create a generic `utils` dumping ground. Put code in the package/module that owns the behavior.

## 5. Dependency Boundaries

These boundaries are mandatory unless an ADR explicitly changes them.

```text
apps/web     -> protocol, content-safe public data
apps/server  -> engine, protocol, content
engine       -> protocol primitives only if needed, otherwise self-contained
content      -> schemas/types; must not depend on web/server runtime code
protocol     -> must remain lightweight and framework-independent
```

Forbidden examples:

- `packages/engine` importing Vue, Nuxt, Pinia, Colyseus, Prisma, `window`, `document`, or Node-specific networking.
- Vue components implementing authoritative rule decisions.
- Client code deciding whether a move, trade, encounter result, or phase transition is legal.
- Sending hidden decks to the browser and hiding them only with UI logic.

## 6. Multiplayer Model

Each active game is one Colyseus room.
Each player/browser has its own WebSocket connection.

Clients send commands such as:

```ts
{ type: "MOVE", destinationId: "rome" }
{ type: "REST" }
{ type: "END_ACTION_PHASE" }
```

The server derives player identity from the authenticated/session connection. Do not trust a client-supplied `playerId` for authorization.

Processing flow:

```text
Client command
  -> runtime validation
  -> authorization / active-player checks
  -> rules engine
  -> authoritative state mutation
  -> domain/game events
  -> synchronized public/player-visible state
```

### Reconnection

A temporary disconnect must not delete the investigator or end the game. Maintain a stable application-level player identity separate from ephemeral socket/session identifiers where necessary.

### Concurrency

Treat commands as serialized state transitions per room. A command must be validated against the current authoritative state at execution time. Do not assume the client snapshot is current.

## 7. Commands, Events and State

Keep these separate.

### Commands
Represent player intent.

```ts
type GameCommand =
  | { type: "MOVE"; destinationId: LocationId }
  | { type: "REST" }
  | { type: "END_TURN" }
  | { type: "ROLL_DICE"; contextId: string };
```

### Events
Represent facts that occurred after validation.

```ts
type GameEvent =
  | { type: "INVESTIGATOR_MOVED"; investigatorId: InvestigatorId; to: LocationId }
  | { type: "HEALTH_LOST"; investigatorId: InvestigatorId; amount: number }
  | { type: "DOOM_ADVANCED"; amount: number };
```

### State
Represents current truth. Separate server-private state from synchronized/public state.

Do not create a single client-visible object containing unrevealed card order, encounter outcomes, condition backs, or other secret information.

## 8. Rules Engine Requirements

The engine must be callable from tests without starting a server.

Preferred shape:

```ts
const result = executeCommand(state, command, context)
```

Where `context` can provide deterministic dependencies such as RNG, timestamps, or IDs.

Avoid hidden global randomness. Random operations must be injectable/seedable so test failures can be reproduced.

When possible, return explicit results/events instead of causing unrelated side effects.

## 9. Game Content Modeling

Prefer stable IDs over display titles.

Good:

```json
{
  "id": "asset_whiskey_01",
  "type": "asset",
  "title": "Whiskey"
}
```

Bad:

```ts
if (card.title === "Whiskey") { ... }
```

Content files should be validated at build/test time. Add schemas and fail fast on duplicate IDs, missing references, invalid stats, or unsupported effect nodes.

For repeated card effects, grow a small effect DSL only after at least several concrete effects demonstrate the abstraction. Do not design a giant universal DSL before implementing real cards.

## 10. TypeScript Standards

- Enable strict TypeScript.
- Avoid `any`. If unavoidable at an external boundary, isolate and document it.
- Prefer discriminated unions for commands, events and effect nodes.
- Use branded/string ID aliases where they prevent accidental cross-use.
- Validate all network input at runtime; TypeScript types alone are not runtime validation.
- Prefer explicit return types for exported engine/protocol APIs.
- Do not use non-null assertions to silence uncertain state unless an invariant is immediately proven.

## 11. Vue/Nuxt Standards

- Use Composition API and `<script setup lang="ts">`.
- Keep components focused on presentation and user interaction.
- Put Colyseus connection lifecycle in a dedicated client plugin/composable/service, not scattered across components.
- Keep room-derived game state conceptually read-only in the UI.
- UI actions send commands; they do not mutate authoritative state optimistically unless an explicit design introduces safe prediction.
- Eldritch Horror is turn-based; default to no client prediction.
- Use SVG for board locations, paths, tokens and hit targets initially.
- Keep accessibility and keyboard interaction possible for modal/card interfaces.

## 12. Colyseus Standards

Colyseus APIs have changed across versions. Before implementing Room/Schema/client code:

1. Inspect the installed Colyseus package versions.
2. Use the documentation matching that version.
3. Do not copy older examples that use obsolete imports or identifiers.
4. Prefer the official current Colyseus skill/docs when available.

Do not assume old patterns such as `colyseus.js`, legacy Room generics, or legacy client identifiers are valid.

## 13. Validation and Security

Every client command must be runtime-validated before rule execution.

Validate:

- command type and payload shape;
- room membership;
- player identity;
- current phase/turn permissions;
- referenced entity IDs;
- resource availability;
- action count / once-per-round limitations;
- target legality.

Never trust hidden game information from the client.
Never put secrets, credentials, private keys, database passwords, copyrighted source PDFs, or production tokens in prompts, docs, tests, or committed configuration.

## 14. Testing Strategy

### Engine tests — highest priority

Every implemented rule should have tests for:

- normal success;
- illegal action;
- boundaries/min/max values;
- interaction with phase/turn state;
- relevant edge cases;
- deterministic random behavior where applicable.

### Server tests

Test:

- room creation;
- join/leave;
- multiple simultaneous players;
- command ownership;
- invalid command rejection;
- room isolation;
- reconnection;
- state synchronization/public filtering.

### Web tests

Use focused component tests where useful and Playwright for a small number of important user journeys.

Critical E2E journey eventually:

1. Player A creates a game.
2. Player B joins from another browser context.
3. Both choose investigators.
4. Game starts.
5. A performs an action.
6. B receives synchronized state.
7. B disconnects/reconnects and resumes the same seat.

## 15. Required Verification Before Finishing a Task

Run the smallest relevant checks during iteration, then before declaring code complete run the repository-standard commands that exist for the touched scope.

Target root commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For multiplayer/server changes, also run server/headless integration tests.
For UI flows, run targeted Playwright tests when available.

If a command does not exist yet, do not pretend it passed. Either add the appropriate script as part of setup or clearly report the missing check.

## 16. Definition of Done

A task is complete only when:

- requested behavior is implemented;
- architecture boundaries are preserved;
- runtime input validation is present for new network input;
- relevant tests are added/updated;
- lint/typecheck/tests for affected scope pass;
- no temporary debug code remains;
- documentation is updated when public architecture, protocol, or setup changes;
- `git diff` is reviewed for accidental unrelated edits.

Do not mark TODOs as complete simply because a UI placeholder exists.

## 17. Git Behavior

- Inspect existing changes before editing.
- Do not overwrite or revert unrelated user changes.
- Keep changes scoped to the requested task.
- Prefer small logical commits if the user asks Codex to commit.
- Never force-push, rewrite history, delete branches, or run destructive Git operations unless explicitly instructed.
- Never commit `.env` files containing secrets.

## 18. Working Method for Codex

For non-trivial tasks:

1. Read `AGENTS.md`, this file, and relevant local docs.
2. Inspect the existing implementation before proposing changes.
3. State a short implementation plan.
4. Implement the smallest coherent vertical slice.
5. Run targeted tests early.
6. Run required final verification.
7. Review the diff.
8. Summarize what changed, tests run, and any remaining limitations.

When uncertain about a rule, do not invent Eldritch Horror behavior. Find the repository rule source/structured content or ask for the missing rule reference if it cannot be inferred safely.

## 19. MVP Priority Order

Unless a user task overrides this sequence, prefer work in this order:

1. Monorepo/tooling baseline.
2. Nuxt app boots.
3. Colyseus server boots.
4. One room with two simultaneous browser clients.
5. Stable player identity + reconnect.
6. Shared protocol package.
7. Pure rules-engine skeleton.
8. Vertical slice: lobby -> choose investigator -> start -> move -> synchronized board update.
9. Core phases/actions/tests.
10. Content ingestion/validation pipeline.
11. Encounters/combat/decks.
12. Mythos/mysteries/Ancient Ones.
13. Persistent saves/accounts.
14. Visual polish and production deployment.

## 20. Current Non-Goals

Until explicitly requested, do not spend major effort on:

- microservices;
- Redis clustering;
- Kubernetes;
- real-time physics/network prediction;
- native mobile apps;
- full expansion support;
- elaborate animation systems;
- complete authentication before multiplayer room mechanics work;
- premature optimization of board rendering.

## 21. Documentation Maintenance

When architectural decisions change, update this guide and/or add an ADR under `docs/architecture/`.
Keep `AGENTS.md` concise. It should act as a map, not duplicate this entire document.
