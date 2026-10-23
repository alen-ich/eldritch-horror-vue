# Cthulhu1 Sea: bound Clue discard and refusal

## Goal and evidence
Enable the complete authored Cthulhu1 Sea instruction. Locally viewed `apps/web/public/cards/encounters/research_cthulhu/01.webp` says: may gain Dark Pact to gain this Clue and Mists; otherwise discard this Clue and resolve a Star Spawn ambush. Current binder rejects both explicit decline and encountered-Clue discard. Existing interpreter already executes optional declines, physical board-Clue discard and named Star Spawn combat.

## Architecture and recommendation
Bind authored `encountered_clue/discard` to a new `discard_encountered_clue` effect using the server-selected marker. Recursively bind both optional reward and explicit decline, rejecting any unsupported child rather than dropping it. Add the exact bound effect to the existing parser/label, interpreter adapter to `resolveBoardClueEffect(discard)`, and marker-reference traversal. No new physical discard implementation or generic effect framework.

On acceptance the existing atomic Condition cost and named Spell lifecycle run. On refusal or inability to gain the cost Condition, discard the bound physical Clue before the first Will test, then use existing Star Spawn Will/Strength decisions. The original marker binding persists through JSON restoration; once discard consumes all marker references, its absence is valid under the existing provenance contract. Rewritten marker references or substituted physical identity must reject before RNG. Duplicate discard must never manufacture tokens or rebind to a replacement marker.

Alternative: special-case this card in the interpreter, which duplicates already-authored branch semantics and weakens provenance. A generic arbitrary-target discard node would exceed this slice. Neither is needed.

## Boundaries and exclusions
Server owns selection, private decisions, RNG and hidden decks. Pure engine remains content/framework-independent. Existing spell/possession/prevention/AO guards preflight all branches; accepting Mists does not enable casting. No new command/public fields, packages, physical Monster changes, awakening, named Artifact rewards or readiness promotion.

## Acceptance and tests
Actual card: accept grants Dark Pact, exact Clue and one Mists; explicit refusal and unavailable/already-held Dark Pact discard only the selected physical Clue and ambush without rewards. Prove discard precedes RNG, Will→Strength ordering, defeat interruption, owner-only choice/rerolls, JSON restoration after marker removal, no second discard, pool conservation and atomic rollback if ambush dice are unavailable. Binder rejects malformed/unsupported decline or prebound marker injection; provenance rejects tampered discard references/physical identity. Real-room restoration checks private options and physical pools. All root checks and three Playwright configs pass sequentially.

## Review
Self-reviewed and approved under delegated user approval. Scope is one complete authored section with existing mechanics; no invented rules. Plan follows before implementation.
