# Location random-input transaction

2026-10-22: Location draw and restored decisions now checkpoint retained deterministic input. The exported direct entry and its command caller return generic RANDOM_INPUT_REQUIRED on partial random exhaustion instead of throwing after consuming input. Resumed general/america/europe/asia_australia decisions use the same pure family helper; Research and Other World retain their own boundaries. Successful transitions commit once; failed results and exceptions roll back dice, IDs, token selection and shuffle input when checkpoint is supported. Contexts without checkpoint remain compatible but cannot undo their external random source.

No printed rule, wire command, state field, client outcome or hidden-data projection changed. Server supplies random input and clients send validated intent/owner choices. Private exception details remain suppressed. Tests cover direct/command partial dice, a paid reroll restored from JSON followed by ID exhaustion, all four regional resume cases, successful consumption, non-owner refusal, no-checkpoint compatibility and all retained sequences on failure/exception.

This is a prerequisite for Location physical discard/recycling, which remains unimplemented: current Location completion still returns its card to the deck bottom. No Location family readiness promotion is claimed.

The pre-existing dirty packages/engine/src/index.ts integration and a browser baseline correction in the already-untracked Norman Acquire test are saved as exact already-applied deltas in docs/superpowers/patches/2026-10-22-location-random-working-tree.patch. Do not apply twice; this save depends on existing working-tree prerequisites and is not a standalone clean-checkout implementation. New module/tests are scoped normally. The browser correction handles a trace-confirmed random starting Monster in Arkham through legal Travel, without changing product rules.

Spec, test results and execution decisions: docs/superpowers/specs/2026-10-22-location-random-design.md and docs/superpowers/plans/2026-10-22-location-random.md.

Verification: root lint/typecheck/test/build passed;1440 engine,127 content,21 protocol,300 server tests. Independent focused13/13. Browser final serial default7/7, Norman2/2, Spell2/2. Initial default-parallel failures (random Monster in the existing Norman scenario, then guest navigation timeout) and the correction/serial rerun are recorded in the ledger; parallel performance is not certified by serial success.
