# Research draw inventory integrity — 2026-10-22

Before resolving Research, configured physical inventory now requires the selected Ancient One's exact eight distinct cards. Full32 catalog validation and deck conservation run before instruction binding, random consumption or state mutation. Missing, sparse, duplicate, foreign and cross-deck cards reject with a generic ENCOUNTER_CONTENT_MISSING. Legacy callers without researchEncounterSetup retain their existing fixture behavior. No public fields, package dependencies or executable card effects were added.

Verification: lint, typecheck and build passed. Engine 1378/1378, content 127/127, protocol 21/21 and server 295/295 passed. Full Playwright passed 7/7 with --workers=1. Default parallel run passed 6/7; Norman acquisition timed out awaiting the guest roster during initial connection, before gameplay. Its subsequent serial run passed without a code change. pnpm 10.28.0 was invoked from its installed local executable because the global shim attempted blocked registry resolution. Network suites required local HTTP/WebSocket access outside the restricted sandbox.

Independent clean-context review found no substantive defect. Deferred minor: valid-inventory tests use an empty instruction catalog and could more directly prove supported-top success versus unsupported-top refusal with supported cards below. Existing top-selection code is unchanged.

Execution rulings: corrected test RNG API to rollDie; expanded eleven synthetic multiplayer Research scenarios to preserve all eight cards; registered the added room test in the existing shared Colyseus lifecycle after a separate boot conflicted with the full suite. These changes preserve test intent. No production fallback or snapshot repair was introduced.

This iteration was developed on extensive pre-existing uncommitted work, including physical Research setup. Only this iteration's changes are staged/committed; verification describes the current workspace, not an independently reconstructed clean checkout of its commit. The existing prerequisite work remains in place.

Next dependency: bind restored Research continuations to the selected physical top, owner and original Clue marker before accepting choices; then introduce physical discard/recycle. This iteration validates initial draws only and does not claim restoration integrity or full Research readiness.
