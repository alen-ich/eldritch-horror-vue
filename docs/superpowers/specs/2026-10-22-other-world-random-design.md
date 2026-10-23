# Atomic Other World deterministic input

## Intent and evidence
Next dependency toward physical Other World discard/recycle is atomic random input. Current resolveOtherWorldEncounter and Other World RESOLVE_DECISION bypass the checkpoint wrappers used by Spells, Norman and Expedition setup. A partially exhausted dice sequence can throw after consumption while the original game state remains unchanged. Retrying then produces a different result or exhausts earlier. This must be fixed before adding another shuffle boundary.

## Scope and architecture
Keep the pure engine and existing commands. Add an internal withOtherWorldRandomTransaction(context, run): CommandResult helper in packages/engine/src/other-world-random.ts. Checkpoint before execution, commit successful results, roll back rejected results and exceptions. Convert exceptions to RANDOM_INPUT_REQUIRED with a generic message, following existing transaction helpers. Wrap the public direct Other World entry point and resumed Other World RESOLVE_DECISION in executeCommand. Avoid double wrapping initial commands by letting their existing dispatcher call the wrapped direct entry point.

## Alternatives
Recommended: family-scoped transaction using the existing EngineContext.checkpoint contract. A global executeCommand transaction changes unrelated families and error semantics; defer it. Preflight input-length checks cannot predict nested branches, token draws, IDs and future shuffles. No dependency package is needed.

## Authority and privacy
Server supplies context, rolls and shuffles; clients only send validated intent and owner decisions. No network schema, synchronization or public fields change. No hidden queue, input sequence or error detail is exposed. Contexts without checkpoint retain compatibility: exceptions become rule errors, but random rollback cannot be guaranteed for such contexts. Preserve existing owner/phase/Gate/content guards and state version semantics.

## Acceptance and tests
Both direct and command initial draw return rule errors instead of throwing on partial random exhaustion; input state and retained deterministic sequences remain unchanged. Resumed decisions roll back a consumed die and physical payment on failure, including failure after rolling while generating an ID or nested test. Rejected results also roll back; successful transitions retain consumed input. Unknown/wrong owner and corrupt binding reject without consuming input. JSON restored decisions behave identically. Existing physical card conservation and private projections remain unchanged.

## Exclusions
No physical discard migration, card effects, readiness promotion, Location/Research RNG change or new dependencies. Current directory/branch, preserve unrelated dirty changes, no commit/push/merge/deploy. User explicitly delegates self approval and inline execution.

## Review
Self-review: focused dependency, explicit compatibility limit and exact boundaries; no placeholders or conflicting requirements. Self-approved 2026-10-22.
