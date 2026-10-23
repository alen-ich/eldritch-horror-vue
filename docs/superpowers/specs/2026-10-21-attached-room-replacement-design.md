# Attached room replacement

## Goal and evidence
The next prerequisite is releasing the previous attached transport when a newer successful connection replaces it. useGameRoom.attach overwrites the Room reference without leaving the previous Room; callback guards prevent stale writes but retain a live server connection. Existing pending-request ordering is already implemented. No new npm dependency is needed.

## Design and alternatives
Use a small pure replacement helper: publish the next Room synchronously, then invoke consented leave on a distinct previous Room, without awaiting cleanup. Contain synchronous throws and rejected cleanup promises. Publishing first makes existing object-identity guards suppress synchronous old callbacks. Initial attachment and same-object attachment never leave the current Room. Pending/failed requests retain the old attached transport until a successful replacement.

Alternatives: leave before matchmaking sacrifices the working connection on failure; awaiting old leave delays the latest room indefinitely. SDK 0.18.2 source confirms leave defaults to consented=true. Use explicit true.

## Authority, privacy and scope
Server state, authorization, seat retention and runtime command validation remain unchanged. Old callbacks cannot publish private decisions or tokens after replacement. No multi-tab arbitration, explicit leave UI, cancellation, new rules, protocol or package changes. Preserve all existing Git edits, use current branch, no commits/push/merge/deploy.

## Acceptance and tests
Distinct replaced Rooms leave once with consent; next Room becomes current before cleanup callbacks; initial/same Room never leaves; throwing/rejecting/non-settling cleanup cannot block next attachment or publish an error. Exercise helper behavior and existing request/callback tests; run root lint/typecheck/test/build and default plus dedicated multiplayer browser suites.

## Self-review
Requirements are bounded and consistent; no placeholders. Self-approved under user authorization, 2026-10-21.

## Review refinement
An independent reviewer reproduced SDK 0.18.2 reconnecting a dropped obsolete Room after consented leave: its scheduled backoff timer ignores reconnection.enabled. Permanently retired rooms must disable future automatic retries and neutralize the public connection.reconnect entry point before leave(true). This version-specific adapter is shared by attached and stale-success disposal. Current rooms retain normal automatic reconnect. No private SDK API is used in production; test invokes SDK backoff internally solely to reproduce the bug.
