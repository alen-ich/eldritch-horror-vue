# Multiplayer vertical slice

## Data flow

1. Nuxt creates or joins the Colyseus `game` room.
2. The server assigns a stable application player ID and sends it only to that connection.
3. Clients send validated commands without a player ID.
4. The room derives the actor from the connection and calls `@eldritch/engine`.
5. The engine returns either an explicit rule error or a new state plus domain events.
6. The room copies public engine state into Colyseus schema state, which synchronizes to every client in that room.

The engine imports only `@eldritch/protocol`. It has no framework, DOM, network, database, or hidden global randomness dependency.

## Current state

The synchronized public state contains phase, turn number, active player, connection status, selected investigator, location, Health, and Sanity. The lobby exposes the base investigator roster as public content; starting location and resources are initialized authoritatively when play begins. No hidden deck or unrevealed content exists in this slice.

Temporary disconnects mark the player offline and preserve the seat for 30 seconds. The browser stores Colyseus's reconnection token and attempts to reclaim that seat after a reload. If the window expires, the token is discarded and the player must join again.

## Implemented commands

- `SELECT_INVESTIGATOR`: lobby only; duplicate selections are rejected.
- `START_GAME`: host only; requires two players and selections for all players.
- `MOVE`: active player only; destination must exist and be adjacent.
- `END_TURN`: active player only; advances in join order.

## Next milestones

Milestone 8 should introduce `packages/content` with schemas, stable content IDs, duplicate/reference validation, and fixtures. Milestone 9 should expand the phase machine and investigator resources in dependency order. PostgreSQL/Prisma remains deferred until the complete in-memory loop works.
