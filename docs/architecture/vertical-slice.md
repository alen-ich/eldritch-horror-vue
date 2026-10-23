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

The synchronized public state contains phase, turn number, active player, connection status, selected investigator, location, Health, and Sanity. The lobby exposes the base investigator roster as public content; starting location and resources are initialized authoritatively when play begins. A separate card archive exposes the supplied catalog as reference content, but no deck order, card draws, hands, or unrevealed game state exists in this slice.

Temporary disconnects mark the player offline and preserve the seat for 30 seconds. The browser stores Colyseus's reconnection token and attempts to reclaim that seat after a reload. If the window expires, the token is discarded and the player must join again.

### Client connection isolation (2026-10-21)

Each registered client callback checks the attached Room object before changing state, private decisions, errors, connection status or seat-token storage. Late callbacks from an earlier connection are ignored even when both connections share a room ID. Current-connection drop/reconnect and private-message/schema ordering retain their existing behavior. This is presentation isolation; server authorization and hidden-state projection remain authoritative.

Overlapping create/join/reconnect requests now share a latest-request coordinator across composable instances. Only the latest request may attach or report failure; stale successful rooms receive a consented leave, and stale reconnect failures cannot delete the current token. A reconnect without a saved token does not supersede a request. Previously attached transport teardown and multi-tab arbitration remain outside this scope. See `docs/superpowers/plans/2026-10-21-connection-request-order.md` for verification.

## Implemented commands

- `SELECT_INVESTIGATOR`: lobby only; duplicate selections are rejected.
- `START_GAME`: host only; requires two players and selections for all players.
- `MOVE`: active player only; destination must exist and be adjacent.
- `END_TURN`: active player only; advances in join order.

## Next milestones

Expedition inventory also supports internal draw/discard operations: private `expeditionDraw` binds the one revealed card to its owner/origin, public `expeditionDiscardIds` records resolved fronts, and the private undrawn order never synchronizes. The token follows the next top immediately; an exhausted deck recycles previous discards without the in-flight card. No network command or effect execution is enabled. See `docs/superpowers/plans/2026-10-22-expedition-discard.md`. The older shared encounter completion bottom-cycle pattern remains a separately documented rules gap.

Active Expedition setup now uses the content-safe 18-record catalog, a single private `encounter:expedition` deck, and public `activeExpeditionLocationId`. START_GAME randomizes it authoritatively without revealing/drawing the top front; only its back location enters Schema/client rendering. Restored order/location must agree and initialized decks cannot disappear. A client compass marker and inspector label use that synchronized location; no encounter command or effect is enabled. Legacy absent-both snapshots remain unchanged. See `docs/superpowers/plans/2026-10-22-expedition-setup.md`.

Milestone 8 should introduce `packages/content` with schemas, stable content IDs, duplicate/reference validation, and fixtures. Milestone 9 should expand the phase machine and investigator resources in dependency order. PostgreSQL/Prisma remains deferred until the complete in-memory loop works.

### Attached transport replacement (2026-10-21)
A successful connection replacement now publishes the new Room identity before issuing a consented leave on the distinct previous Room. Cleanup throws/rejections are contained and cleanup is not awaited, so old callbacks cannot affect the new connection or block it. Pending or failed matchmaking retains the attached Room. Multi-tab arbitration remains excluded; no server rules or protocol changed. See `docs/superpowers/plans/2026-10-21-attached-room-replacement.md`.
The retirement adapter also closes a socket whose reconnect handshake is still in flight, instead of sending a leave packet to a non-open transport. Regression tests cover both queued backoff and connecting transport. Server seats follow existing disconnect/leave policy; a disconnected old seat may remain until its normal server timeout.

### Room snapshot isolation (2026-10-21)
Successful attachment now clears all room-derived presentation refs before retiring the previous transport, even if the new Room has no populated players yet. New public state then replaces the defaults; stale callbacks remain ignored. Failed/pending matchmaking retains the attached snapshot. No packages, protocol or game rules changed. See docs/superpowers/plans/2026-10-21-room-snapshot-isolation.md.

### Outgoing commands during disconnect (2026-10-22)
The common client send boundary ignores new game commands unless a Room is attached and status is connected. This prevents known-disconnected intents from entering SDK 0.18.2's outbound queue, preserves connection errors, and resumes ordinary versioned sends after reconnect. It does not retract already queued messages or guarantee a fresh snapshot on reconnect; server validation remains authoritative. No package dependency added. See `docs/superpowers/plans/2026-10-22-disconnected-command.md` for tests and actual verification.

### Initial snapshot command readiness (2026-10-22)
Commands additionally require a public snapshot identifying the local seat by the attached Room sessionId. Empty/default state and snapshots containing only other seats cannot send or clear errors. A valid version-zero lobby can send; replacement waits for its own seat, and removing the seat blocks again. Ignored commands are never replayed. Connection status retains transport semantics; server validation remains authoritative. Automatic reconnect freshness remains outside this boundary. See `docs/superpowers/plans/2026-10-22-initial-snapshot-command.md`.

### Automatic reconnect snapshot readiness (2026-10-22)
Following the initial-snapshot boundary, automatic reconnect now invalidates command readiness until the attached room delivers a new state event while connected. The displayed snapshot remains available. Private decision messages reading retained SDK state cannot unlock sends. Unchanged versions and version-zero lobbies work after synchronization; blocked intents preserve errors and are never replayed. No new package, protocol or rule change. See `docs/superpowers/plans/2026-10-22-reconnect-snapshot.md`.

### Connection intent owns callbacks (2026-10-22)
Starting a real create/join/explicit reconnect request revokes callback and command authority from the retained attachment. Its snapshot and transport remain in place until a successful latest-request replacement, but its state/private/error/token/lifecycle events cannot supersede the new intent, including after failure. Successful attachment reactivates callbacks for its exact Room object. Reconnect without a saved token remains a no-op. No server seat policy or rule changes; see `docs/superpowers/plans/2026-10-22-matchmaking-callback.md`.

### Rotated reconnect credentials (2026-10-22)
After automatic reconnect, a guarded microtask persists the SDK's newly assigned reconnection token for subsequent reload/explicit reconnect. The write runs after SDK 0.18.2's synchronous JOIN_ROOM handler, which invokes onReconnect before assigning the token. Superseding requests and replacement Room identities suppress stale deferred writes. Tokens remain in existing private browser storage; no public state, protocol or package changes. See `docs/superpowers/plans/2026-10-22-reconnect-token.md`.

### Browser automatic reconnect regression (2026-10-22)
The default Playwright suite now includes a two-browser lobby journey that invokes the SDK's native offline handler, observes actual transport reconnection and persisted token rotation, reloads and verifies the same host/session/investigator with two seats. A subsequent host command must synchronize to the guest. Removing only rotated-token persistence makes the browser regression fail; restoring it passes. The test simulates an offline notification, not an OS-level outage. See `docs/superpowers/plans/2026-10-22-automatic-reconnect-e2e.md`.
