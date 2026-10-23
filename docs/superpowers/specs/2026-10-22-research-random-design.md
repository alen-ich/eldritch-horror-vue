# Research deterministic random transactions

Research draw directly invokes the interpreter, unlike Other World's existing transaction wrapper. Research continuation commands likewise have no RNG checkpoint. Failed execution can consume retained dice, IDs, tokens or shuffle inputs while leaving canonical state unchanged, making retries nondeterministic.

Goal: wrap public resolveResearchEncounter and Research RESOLVE_DECISION dispatch in a pure checkpoint transaction. Commit input on success; rollback on returned failure or thrown exception. Exceptions become generic RANDOM_INPUT_REQUIRED with no private exception text. Contexts lacking optional checkpoint remain compatible, with no promise to roll back their opaque input. Preserve existing error codes for returned failures. Callers retain immutable canonical input state.

Use the established Other World wrapper pattern in a focused Research module. A global executeCommand transaction would change unrelated rules and is excluded; changing the EngineContext checkpoint contract or adding packages is unnecessary. No server/client/protocol fields, card effects, privacy changes or readiness promotion. Existing continuation inventory validation stays before dispatch.

Acceptance: direct and command draws restore partial dice on exhaustion; failed paid reroll restores die and caller Clue inventory after later ID exhaustion; successful retained-context draw/reroll consumes once; rejected non-owner consumes nothing; wrapper restores all four input kinds on returned failure and exception; no-checkpoint compatibility. Run all four root checks, relevant multiplayer and serial Playwright. One fresh review.

Self-review complete, focused scope and explicit compatibility. Self-approved under delegated authority on 2026-10-22.
