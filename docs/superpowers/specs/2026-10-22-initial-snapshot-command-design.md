# Initial snapshot command readiness

## Intent and evidence
The next prerequisite for reliable multiplayer commands is an attached room's own-seat snapshot. This is a continuation of the disconnected-command boundary, not a new package dependency. The existing composable marks a room connected before its first populated state; SDK 0.18.2 acknowledges JOIN_ROOM separately from state messages. `syncState({})` clears identity but `send` currently permits version-zero commands. Extensive pre-existing working changes must be preserved.

## Scope and architecture
Keep the existing connection status semantics. At the single `send(command: GameCommand): void` boundary, require an attached connected room and a nonempty playerId derived from that room's public players/sessionId. Before that snapshot, ignore commands without clearing errors or queuing/replaying them. A legitimate lobby snapshot at stateVersion 0 must work. When a later snapshot omits the own seat, block again. Replacement clears identity, and stale callbacks cannot restore readiness.

## Alternatives
Recommended: reuse the canonical own-seat projection, avoiding a second readiness flag. A separate boolean tied to any state callback could mistakenly accept empty/default schema. Waiting for a positive version rejects valid version-zero lobbies. Adding database persistence or more investigator rules does not close this earlier transport prerequisite.

## Authority and privacy
Client gating is presentation/transport hygiene only; the server continues runtime validation, ownership, current-version and rule checks. No engine, wire interface, hidden state, private decision payload or dependency changes. No optimistic rule outcomes.

## Acceptance and tests
Exercise the real composable with simulated SDK callbacks: empty attached state suppresses commands and preserves errors; a snapshot containing another seat does not unlock; own-seat version 0 unlocks exactly one explicit send; replacement requires its own snapshot; stale old-room callbacks do not unlock; removing own seat blocks again. Existing drop/reconnect and snapshot isolation regressions must pass. Run lint, typecheck, full tests including multiplayer, build and all existing Playwright configurations.

## Exclusions
No guarantee of fresh state after automatic reconnect, SDK queue retraction, multi-tab arbitration, persistence, rules expansion, new browser fixture, commits, push, merge or deploy. The new timing boundary is tested through the actual composable harness; existing browser tests verify ordinary integration.

## Self-review
Scope, authority, privacy, version-zero semantics and acceptance mapping checked; no unresolved items. Self-approved under explicit user delegation. Architectural documentation workflow selected as requested, with a bounded implementation.
