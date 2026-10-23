# Room callback isolation

## Intent and evidence
The next prerequisite is reliable client room isolation before expanding private game decisions. Existing uncommitted Norman action/acquisition and inbox work is preserved. Inspection of `useGameRoom.attach` shows callbacks from every attached Room can still write shared refs, storage and the private inbox after another Room attaches. Clearing the inbox alone does not stop a late old message repopulating it. This is a concrete client lifecycle gap in the documented room isolation/reconnect requirement, not a missing npm package.

## Scope and design
Use a small framework-independent callback guard whose predicate compares the currently attached Room object with the source Room object. Apply it to state, command errors, private decisions, seat tokens, drop, reconnect and leave callbacks. Distinct connections to the same room ID must remain distinct. Keep legitimate drop/reconnect on the current object working. Guard before all side effects, including private inbox receipt and storage writes.

Recommended: object-identity guard, using existing shallow Room ref. Alternative: unsubscribe every old callback; more lifecycle bookkeeping and SDK coupling. Room-ID checks are insufficient for reconnect to the same room. No new dependencies, server/protocol changes, game-rule changes, transport teardown or competing create/join request arbitration in this slice.

## Authority and privacy
Server remains canonical; client filtering only controls which connection presents state and private choices. No new hidden data is sent. Ignored obsolete callbacks cannot contribute private choices or overwrite current public state or credentials. Existing current-connection schema/private-message reconciliation remains intact. Existing runtime validation on server commands remains unchanged.

## Acceptance and tests
After attaching B, delayed A callbacks cannot change current state, decision, error, connection status or seat token. A and B may share a room ID. Current callbacks still run, including drop/reconnect. Existing owner inbox delivery ordering and reload flows remain green. Add deterministic callback tests to the existing server Mocha runner (as for the pure inbox); run real multiplayer suite and existing production, Norman action and Spell Playwright regressions. Run root lint/typecheck/test/build and diff check.

## Review and approval
Self-review: scope is one prerequisite, interfaces preserve server authority, no unspecified rules or placeholders. Self-approved under the user's explicit authorization; execute in current directory/branch, preserve other edits, no commit/push/merge/deploy.
