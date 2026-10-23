# Persist rotated reconnect credentials

## Goal and evidence
Preserve the latest valid SDK reconnection token across automatic reconnect followed by page reload. Current useGameRoom stores the token only in attach. Installed core 0.18.14 generates a new client token on connection and updates the prior client's token during reconnection; installed SDK 0.18.2 assigns Room.reconnectionToken after invoking onReconnect. Reading it synchronously in that callback saves the old credential.

## Design and alternatives
Recommended: schedule a guarded microtask in onReconnect to persist nextRoom.reconnectionToken after the SDK finishes JOIN_ROOM processing. Reuse the current attachment/Room identity guard inside that deferred callback, so replacement requests or successful newer attachment cannot be overwritten. Each automatic reconnect replaces the saved token; explicit reconnect continues consuming the stored token through existing request ordering.

Waiting for a state callback leaves a larger reload window and performs redundant storage writes on ordinary patches. A timer adds unnecessary delay. Reading synchronously captures the old token. No package, server, protocol or game-rule changes are needed; queueMicrotask is available in the supported browser runtime.

## Authority and privacy
Only the active attached Room may write its SDK token. Credentials stay in existing localStorage; do not expose them in public state, logs or documentation examples containing real credentials. Server validation of reconnect tokens and stable seat identity remains unchanged. Superseded attachment microtasks must be inert, even for reused room IDs.

## Acceptance and tests
With real composable and simulated SDK order: invoke reconnect, then replace room.reconnectionToken synchronously, then flush microtasks. Storage must contain the new token, including after repeated reconnects. Subsequent explicit reconnect must receive the latest stored credential. If a newer request starts or a replacement attaches before the deferred write, the old Room cannot overwrite credentials. Initial attach and existing callback/send/snapshot isolation remain intact.

## Limits and review
No durable server persistence, multi-tab arbitration, storage-failure policy, seat-token redesign or changes to already queued SDK messages. Token updates are tested with deterministic lifecycle ordering; normal reload and multiplayer browser suites remain regression checks. Self-review found a single coherent lifecycle change with no unknown requirement. Self-approved under user delegation; current branch, inline execution, no commit/push/merge/deploy.
