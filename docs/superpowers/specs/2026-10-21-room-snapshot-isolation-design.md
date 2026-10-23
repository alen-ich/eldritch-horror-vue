# Room snapshot isolation design

Date: 2026-10-21. Self-approved under user authorization.

Goal: prevent the previous room snapshot appearing under a newly attached room before its first populated state.
Evidence: useGameRoom.attach clears only the decision inbox; syncState returns early without players. Current callback/request/transport helpers solve different races and do not clear existing refs.
Scope: reset every room-derived presentation ref on successful attachment, including initial attachment, using the same defaults as empty synchronization. Keep stable reactive ref identities. Failed/pending matchmaking preserves the existing snapshot. First populated snapshot resumes normal rendering and versioned intents.
Architecture: syncState accepts an empty state; missing players means an empty roster. attach publishes the new Room then synchronizes an empty snapshot before old transport retirement. Inbox clearing precedes this operation. A real composable harness verifies behavior with Vue reactivity and fake SDK transport only.
Authority/privacy: server state and runtime-validated protocol remain unchanged. Clear active tests, trade, lifecycle, pending decisions and player identity as well as public board fields. Never transfer private options between rooms. Reconnection/seat credentials keep their existing lifecycle.
Alternatives: component-specific hiding duplicates lifecycle logic; per-room snapshot caches add unnecessary retention and complexity. Recommend one reset through the existing projection.
Exclusions: new game rules, package dependencies, multi-tab arbitration, changing server disconnect policy, clearing the still-attached room during pending matchmaking.
Acceptance/tests: populated old room -> successful new room without players leaves all room-derived values at defaults; new populated state renders correctly; failed replacement retains old values; stale old callback cannot restore them. Existing multiplayer/browser regressions must pass.
Self-review: scope, defaults, privacy and failure behavior are explicit; no unresolved requirements. No commit authorized.
