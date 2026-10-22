# Other World state integrity (2026-10-22)

`validateOtherWorldState` in the pure engine now checks initialized physical card identity conservation and the current top-bound encounter's owner, reveal, origin Gate and Gate zones. Live draw/continuation and room restoration share this boundary. Restoration also refuses to remove a deck already initialized in that room. Invalid snapshots reject before synchronized or private state changes; validation never repairs order or consumes randomness.

Legacy states with neither deck nor active Other World encounter remain supported. Small explicit catalogs in engine fixtures are valid; production uses all 24 known physical IDs. Closed Gates can already be in a replenished private supply, because empty Gate stacks recycle immediately. Deck order and continuation bindings remain private; no command, Schema field, client behavior or package dependency is added.

This is a prerequisite for physical Other World draw/discard migration. The existing shared encounter completion still cycles Location, Research and Other World cards to the bottom. No discard/recycle correction or content-readiness promotion is claimed here. Expedition's separate internal physical draw/discard operations are unchanged.

Specification and execution record: `docs/superpowers/specs/2026-10-22-other-world-integrity-design.md` and `docs/superpowers/plans/2026-10-22-other-world-integrity.md`. The pre-existing untracked Other World discard design is preserved for the subsequent lifecycle task.
