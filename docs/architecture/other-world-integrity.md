# Other World inventory lifecycle (2026-10-22)

The pure validateOtherWorldState boundary checks known unique physical IDs across private undrawn order, the private active binding and faceup otherWorldDiscardIds. Direct draw and restored continuation share this boundary with room restoration, which rejects malformed inventory before mutation and cannot strip an initialized deck. Sparse arrays, unknown/duplicate IDs, inconsistent owner/reveal/Gate binding and malformed flags reject without repairing order.

A drawn card leaves its deck before effects. The private pending continuation records cardRemovedFromDeck:true; normal completion and defeat cleanup discard that card exactly once. Drawing the last undrawn card immediately replenishes from previous faceup discards, excluding the active card. A one-card fixture replenishes on completion. Shuffle output must conserve identities. Legacy full inventories and saved top-bound continuations remain supported; top-bound pending cards migrate once on their cloned transition. Order changes among remaining undrawn cards are not a pending-card binding violation after removal.

Only faceup discards, revealed front and existing public decision summaries synchronize. The private order, active binding, flag and owner options never enter public projection. The client exposes a readonly discard list and clears it on room replacement. No new command or card effect is introduced. Server owns all outcomes.

Initial draws and resumed Other World decisions checkpoint retained deterministic input, rolling back all four sequences on rejected results or exceptions and preserving successful consumption. Errors use generic RANDOM_INPUT_REQUIRED text. Contexts without checkpoint remain compatible but cannot restore their external random source.

Location and Research completion still cycles to the deck bottom and requires a separate physical lifecycle migration. No family/full-game readiness promotion is claimed. Expedition internal inventory remains separate.

Specs and execution journals: docs/superpowers/specs/2026-10-22-other-world-discard-design.md, docs/superpowers/plans/2026-10-22-other-world-discard.md; RNG prerequisite docs/superpowers/plans/2026-10-22-other-world-random.md.

## Expedition projection prerequisite (2026-10-22)
The shared public/player projection also copies/defaults expeditionDiscardIds. Mutation of a projected discard list cannot alter canonical physical inventory, and later canonical changes cannot alter an already returned view. This fixes the same pre-existing array alias found during Other World review; no Expedition rule, transport field or family readiness changes. Spec and execution: docs/superpowers/plans/2026-10-22-expedition-projection.md.
