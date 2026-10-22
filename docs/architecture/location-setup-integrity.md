# Location physical setup integrity

2026-10-22: buildLocationEncounterDecks now validates every catalog slot, unique nonempty string IDs, four known deck assignments and nonempty decks before invoking its first shuffle. Each returned order must densely conserve exactly its own identities. Input copies tolerate in-place shufflers; output copies isolate all four decks even if the shuffler reuses a mutable buffer. Partial fixtures remain valid; no printed card counts are imposed.

The Location START_GAME boundary now uses the existing random transaction independently of optional Research/Expedition/starting-Spell content. Generic errors replace escaped setup exceptions and retained deterministic input is restored after partial consumption. No public field, command, UI rule, dependency or card effect changes. Physical Location discard/recycling remains pending.

Tests reproduced sparse-catalog acceptance, unknown/non-string entries, premature random consumption on a missing deck, corrupt shuffle acceptance and cross-deck buffer aliasing. A second RED pair reproduced bare START_GAME exceptions and input exhaustion; the final fix preserves source state and retained input. Independent review passed the initial24 focused tests without blocking helper findings; its conditional-wrapper qualification was promoted to a required integration fix, then verified RED→GREEN (26 focused tests). Explicit private-ID omission assertions remain a deferred minor; error messages are generic on inspection.

setup.ts was clean at entry and is committed normally with new tests/docs. The small already-applied index.ts integration is saved as docs/superpowers/patches/2026-10-22-location-setup-integrity-working-tree.patch because index.ts contains unrelated dirty prerequisites. Do not apply twice. This save requires the current working-tree foundation and is not a standalone clean-checkout implementation.

Spec and execution evidence: docs/superpowers/specs/2026-10-22-location-setup-integrity-design.md and docs/superpowers/plans/2026-10-22-location-setup-integrity.md.

Verification: pnpm lint, typecheck, test and build exited0. Root test included engine1457, content127, protocol21 and server300 tests, including real multiplayer integration. Sequential Playwright passed7 main,2 Norman and2 Spell cases. Patch reverse-applicability and whitespace checks passed.
