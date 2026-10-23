# Named Mists of Releh Research reward

2026-10-23: Cthulhu6 City is executable: Observation success gains the bound physical Clue and one Mists of Releh Spell; failure gains Paranoia. The locally viewed Research6 crop confirms the authored mechanics. This raises parsed/executable Cthulhu sections from20 to21 of24 for supported holdings.

Only `spell_mists_of_releh` is admitted as a named encounter reward. Dynamic preflight requires its catalog kind and valid physical inventory before draw/RNG, including restored private queues. Application uses existing pure `gainSpell` with a kind request, preserving double-sided search, post-search shuffle, unavailable-supply behavior and version-neutral transfer. No new server/content mapping or protocol was needed.

The existing server owns inventory, RNG and decisions. JSON-restored Observation choices retain owner-only resolution; public projections expose fronts, never physical backs or Spell deck order. Failed shuffle input rolls back Clue/card/Spell changes and deterministic dice through the Research transaction. An unavailable named Spell leaves the Clue reward intact without manufacturing a copy.

This is a reward feature only. Holding Mists continues to trigger the conservative unsupported encounter-effect guard; casting remains unimplemented. Follow-up: [Cthulhu1 Sea refusal](research-refusal.md) now retains the complete discard/ambush branch. Named Artifact rewards, generic Spell IDs, possession/awakening support and family readiness are unchanged.

Implementation delta in previously dirty `packages/engine/src/index.ts` and server test registration is saved only in already-applied `docs/superpowers/patches/2026-10-23-research-mists-{index,GameRoomTest}.patch`. Do not reapply. Existing dirty foundations remain outside the commit and are required to reproduce this working directory. Results and review: `docs/superpowers/plans/2026-10-23-research-mists.md`.
