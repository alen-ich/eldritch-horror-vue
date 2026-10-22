# Location continuation binding

Goal: reject corrupt Location reveals/continuations before command effects or room restoration. This is a prerequisite for physical discard, not that lifecycle itself.
Scope: four Location families, pure validator, engine direct draw/command and server restore boundaries. No new fields, packages, card rules, wire or UI changes; no complete inventory conservation yet.
Recommended: follow Research shared validator pattern; validate phase, active existing encounter owner, matching reveal, top-bound card and matching catalog family. Reject foreign Gate/removed-card metadata. Identify orphan reveals from catalog or canonical Location prefixes. Do not bind current location or decision owner: card effects may move the investigator or offer colleague reactions.
Alternatives: only check completion (too late after effects); implement full discard now (larger state/projection migration, unsafe without binding checks).
Server owns canonical state, clients retain existing validated intents. Validator returns generic diagnostics without card IDs or private deck contents; it does not mutate input. Unrelated encounter families and absent reveals remain compatible; partial catalogs remain supported, but bound active card must exist.
Acceptance: valid JSON roundtrip for each family; orphan/mismatched reveal, wrong phase/owner/top/catalog and foreign metadata rejected before effects/randomness; real two-peer restoration rejects before room mutation and keeps remaining order private. Existing movement/colleague behavior preserved.
Tests: table-driven pure/command tests and direct-draw orphan regression, real room restore test, root lint/typecheck/test/build and serial Playwright configurations.
Self-review: scope, privacy and compatibility checked; self-approved under explicit user delegation. Physical discard/recycling remains separate.
