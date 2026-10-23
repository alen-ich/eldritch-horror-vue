# Automatic reconnect and reload browser coverage

## Goal and confirmed gap
Protect the real SDK/server/browser integration behind the preceding reconnect fixes. Existing Playwright tests reload pages to exercise explicit reconnect, but do not break an established WebSocket, observe automatic reconnect/token rotation, and then reload again. Deterministic composable tests cannot verify that the real browser/server lifecycle preserves the same seat.

## Recommended approach and alternatives
Add one default-suite test in tests/e2e/automatic-reconnect.spec.ts. Observe the host's native game WebSockets through Playwright's websocket event. After the connected lobby has exceeded SDK 0.18.2's 5000 ms minUptime, dispatch the browser offline notification: the installed SDK's Connection.ts offline handler closes its actual socket with reconnectable code 4010. Observe a new transport, rotated persisted token, same local investigator/host role and two-player roster. Reload; verify the same seat/selection/room and a fresh host command synchronized to the independent guest.

Replacing WebSocket or SDK classes would verify a simulation; broad offline emulation can interrupt Nuxt. A test-only forwarding proxy was initially investigated using installed Playwright declarations and official WebSocketRoute documentation (https://playwright.dev/docs/api/class-websocketroute), but failed before connection with protocols[0]: expected string, got object. The native SDK offline hook avoids that proxy incompatibility while closing the real socket. It simulates a transient offline notification, not a full operating-system outage.

## Boundaries and privacy
No production implementation, dependency, protocol or server-state changes. The server owns identity, room membership and command outcomes. Test assertions use public UI and transport/session observations; credentials are compared as booleans without printing token values. Keep test-only controls out of production code.

## Acceptance and regression proof
Two browser contexts create/join one lobby and choose different investigators. The host loses its established game transport, reconnects automatically without manual action, saves a rotated token, reloads and remains host with its original investigator and exactly two seats. Its Ancient One selection then synchronizes to the guest. URL and reconnect session remain stable. A controlled omission of only the preceding token-persistence write must make the new test fail; restore it and require GREEN. Fixed waiting is limited to satisfying the SDK's documented installed minimum uptime, observed via a polling elapsed-time condition; all other waits observe UI/network/storage conditions.

## Exclusions and approval
No packet loss/stress matrix, proxy in production, new game rules or complete browser coverage for every private decision. Current deterministic event-order tests remain the precise checks for command suppression windows. Self-reviewed and approved under user delegation; inline current branch, preserve all edits, no commits or publication.
