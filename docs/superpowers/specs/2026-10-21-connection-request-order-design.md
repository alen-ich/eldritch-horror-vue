# Connection request ordering

## Goal and evidence
The next necessary dependency is reliable connection request ordering before adding more private decisions, not an npm package. `useGameRoom` already guards attached Room callbacks, but each create/join/reconnect awaits independently and unconditionally attaches or reports failure. A slower old request can replace the latest room or delete its reconnection token. Existing unrelated changes are preserved.

## Design and alternatives
Use one module-scoped latest-request coordinator shared by all composable instances. Starting a real request supersedes prior requests. Only the latest completion may attach or handle failure; stale successful rooms are left with the installed SDK's consented `leave()` and cleanup rejection is contained. Stale reconnect returns false. No-token reconnect does not supersede anything. Existing attached-room callback guards remain.

Alternative serialization delays the user's latest intent behind a slow request. Disabling UI buttons cannot protect multiple composable callers or reconnect overlap. Request identity is the smallest complete solution. No new packages, protocol fields or server changes.

## Boundaries and exclusions
Server owns game state, authorization and validation. No rule outcome moves into the browser. Obsolete completions cannot publish private choices, credentials, errors or room identity. This slice handles pending request results only; previously attached transport teardown, cancellation of matchmaking already in flight, multi-tab token arbitration and server seat policy are excluded.

## Acceptance and tests
Deferred requests completed in either order leave only the newest attached; stale success is disposed exactly once, including when the latest request failed. Stale failures cannot alter status/errors/storage. Latest success and failure retain existing behavior. Reconnect cleanup only happens for a current failure. Cleanup throwing/rejecting must not disturb a newer room. Test the pure coordinator with deferred Promises and run production multiplayer/browser regressions plus lint/typecheck/test/build.

## Review
Architectural workflow requested by user; self-review found no ambiguity or missing requirements. Spec self-approved under explicit user permission. Current directory/branch; no commit/push/merge/deploy.
