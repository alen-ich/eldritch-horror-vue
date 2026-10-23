# Disconnected command boundary

## Intent and evidence
The next prerequisite after room callback/request/snapshot isolation is preventing new game intents from entering the transport during a known disconnect. `useGameRoom.send` currently calls Room.send regardless of status. Installed SDK 0.18.2 Room.ts queues sends while reconnecting and flushes them on reconnect. Existing documentation describes connection isolation but does not claim this outgoing boundary is implemented. No new npm dependency is necessary.

## Scope and approach
Keep the current composable API and add an early return in its common send(command: GameCommand): void entry point unless an attached room exists and status is connected. Ignored commands neither call Room.send nor clear the current error. Connected commands retain the existing expectedStateVersion envelope and error reset. Stored snapshots and owner choices remain visible during a disconnect; they do not authorize sending.

Alternatives: per-button disabling duplicates policy and misses programmatic callers; changing SDK reconnection queues affects transport behavior beyond game intents. The centralized guard is the smallest complete boundary.

## Authority and privacy
Server identity, runtime command validation, version checks and rules remain authoritative. The client guard prevents accidental deferred intent, not malicious commands. No new public state, private messages, storage or content exposure. Engine and protocol remain unchanged.

## Exclusions
No removal of messages queued before drop notification; no new snapshot-freshness guarantee on reconnect; no multi-tab arbitration, rule expansion, npm installation, UI redesign or transport replacement. Failed matchmaking retains existing idle status and snapshot policy; sending stays blocked until connected again.

## Acceptance and tests
Exercise the real composable through the existing Vue/VM transport harness. Idle without a room, current-room drop, final leave, pending matchmaking and failed matchmaking must not send game commands or erase errors. Restored connection sends exactly one versioned command with the current public version; blocked commands are never replayed. Obsolete room callbacks cannot unlock the current disconnected connection. Seat-token transport messages remain independent.

Run focused Mocha tests, root lint/typecheck/test/build, default Playwright and dedicated Norman and Spell configurations. Existing server tests supply multiplayer authorization coverage; the new boundary is tested with simulated transport rather than a new browser outage fixture.

## Self-review and approval
Checked scope, ambiguity, authority, privacy and acceptance mapping: no unresolved items. Self-approved under the user's explicit delegation. Current directory/branch; preserve all pre-existing edits; no commit, push, merge or deploy.
