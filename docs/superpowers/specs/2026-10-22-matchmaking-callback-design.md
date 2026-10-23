# Matchmaking callback ownership

## Goal and evidence
Keep the latest create/join/explicit reconnect intent authoritative over client connection presentation. The existing coordinator orders request completions, but useGameRoom's callback guard checks only attached Room identity. While a replacement is pending, that identity still points at the previous Room. Its reconnect/state callbacks can mark status connected and enable commands; its errors can replace the latest request's outcome. Code inspection confirms this gap independently of the prior reconnect-snapshot fix.

## Recommended design
Revoke the current attachment's callback/send authority when a real create/join/reconnect request starts. Reactivate only on successful latest-request attachment. Keep the old snapshot and transport while pending or failed, matching existing replacement behavior; callbacks from that attachment remain inert after failure. Successful attachment resets snapshots and retires the old transport through existing helpers. Reconnect without a stored token remains a no-op and must not revoke authority.

Use a module-local attachment-active boolean, shared with the existing module-local Room and request coordinator. All guarded callbacks require both active attachment and exact Room identity; send requires active attachment independently of status. No new dependency or protocol change.

## Alternatives
Checking only request pending status re-enables old callbacks after failure. Immediately retiring the old transport changes seat/disconnect behavior before replacement succeeds. Per-request generation objects can also work, but add interfaces without needing to distinguish concurrent attachments: the existing latest-request coordinator already owns completion ordering.

## Authority, privacy and limits
Server authorization, command validation, deterministic rules and private projections remain untouched. Revoked callbacks cannot publish old private decisions, credentials, state or errors during a new connection intent. This does not erase the retained presentation until a successful replacement. No room cancellation, multi-tab arbitration, token rotation, new rules, packages or content readiness promotion.

## Acceptance
For create, join and token-backed reconnect, late attached-room drop/reconnect/state/error/seat/private-message callbacks cannot alter the latest request's connecting status, error, storage, retained state or command eligibility. After latest failure, old callbacks remain inert and commands remain blocked. Latest success activates its own Room, supports its own state and command callbacks, and ignores previous callbacks. No-token reconnect preserves a usable attachment. Existing request completion ordering, same-ID identity guards and initial/reconnect snapshot boundaries remain valid.

## Tests and approval
Extend the existing real-composable harness to simulate all three request methods and real in-memory storage. Deferred request regressions assert literal statuses, errors, snapshots, credentials and command counts before and after settlement. Run root checks, server integration and all three browser configurations. Self-review: coherent single client boundary, no unresolved requirements. Self-approved under user delegation; inline current-branch execution, no commits.
