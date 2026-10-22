# Research reveal restoration integrity

Current status: new Research draws now retain explicit original marker/token provenance; see [Research marker binding](research-marker-binding.md). Earlier pending statements below are historical.

2026-10-22: A current Research reveal must have a pending Research continuation. The shared pure validator now rejects absent or unrelated pending work instead of allowing an orphan reveal through room restoration or command dispatch. Normal completion clears both fields; lastLocationEncounterCardId remains valid independently. Partial legacy test catalogs remain supported.

Generic errors reveal no card ID, and rejected commands/restoration preserve version, random input and canonical/public state. Engine regressions cover orphan states and accepted unrelated/completed states. Two real peer tests assert restoration failure before mutation or synchronization. No protocol, client behavior, printed card effect or physical discard/recycle change is introduced.

Independent review checked normal completion, lethal damage and combat pauses without finding a valid orphan state. Physical Research discard/recycling and explicit original marker binding remain follow-ups; this invariant alone does not certify full Research readiness.

Spec and execution results: docs/superpowers/specs/2026-10-22-research-orphan-reveal-design.md and docs/superpowers/plans/2026-10-22-research-orphan-reveal.md.
