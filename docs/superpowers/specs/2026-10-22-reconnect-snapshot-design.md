# Reconnect snapshot command readiness

## Intent and evidence
Prevent commands using a retained pre-disconnect snapshot during automatic reconnect. This is the next prerequisite following initial snapshot readiness, explicitly excluded by that implementation. Installed SDK 0.18.2 invokes onReconnect while processing JOIN_ROOM; ROOM_STATE invokes onStateChange separately. The current composable immediately marks transport connected and permits the retained playerId/version.

## Scope and architecture
Keep the existing public transport status and displayed snapshot. Track command snapshot readiness separately in apps/web/app/composables/useGameRoom.ts. Invalidate on attached-room drop, final leave and attachment. Only the attached room's onStateChange after reconnect can restore readiness, and send still requires its own seat. Do not restore readiness by reading retained nextRoom.state in a private-message callback. Repeated reconnects must invalidate again. Initial populated attachments remain usable.

## Alternatives
Recommended: explicit event-driven readiness; no new dependencies or protocol. A timeout guesses network timing. Requiring a larger canonical version incorrectly blocks unchanged rooms and version-zero lobbies. Clearing displayed state unnecessarily hides useful reconnect context.

## Authority and privacy
The server continues validating identity, ownership, rules and expectedStateVersion. The client only suppresses intent transmission. No engine, network schema, hidden-state projection, token or card content changes. Private messages may update presentation but cannot certify synchronized state.

## Acceptance and tests
The real composable must suppress sends after drop and after reconnect until a new state callback; blocked sends preserve errors and are never replayed. Private pending-decision messages reading old room.state cannot unlock. Fresh own-seat state permits an explicit send with its observed version, including unchanged version 42 and version zero. Other-seat snapshots block. A second drop and stale replaced-room callbacks cannot unlock. Existing initial-attachment and connection-race cases stay green.

## Exclusions
No retraction of previously queued messages, reconnect token rotation, multi-tab arbitration, new game rules, or general transport rewrite. Broader rules/content gaps remain documented. Browser suites verify existing multiplayer flows; event-order windows receive deterministic composable regression coverage.

## Review
Self-review: no placeholders or contradictory contracts; each acceptance case has a defined event sequence. Approved under the user's explicit delegation. Execute inline in current branch; preserve unrelated changes; no commits.
