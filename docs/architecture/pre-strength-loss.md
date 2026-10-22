# Pure pre-Strength Sanity-loss prerequisite

2026-10-23: `StandardCombatInput.beforeStrengthSanityLoss` optionally supplies a nonnegative integer raw loss, default zero. The pure kernel resolves Horror first, then this loss only before an existing Strength check. Total Sanity loss is capped at current Sanity; defeat ends combat before Strength RNG or Monster damage. Surviving investigators retain the existing Strength and simultaneous Health/Monster damage calculation.

This represents the timing needed by the verified Cthulhu Cultist profiles without importing content. It is a calculation primitive, not an ordinary-loss prevention or authoritative command interpreter. No live Cultist parser/preflight guards, private continuations, rerolls, physical Monster pools, readiness or network projections changed. The optional field is already exposed by the existing combat export.

Follow-up: the verified normal Cthulhu profile now crosses the server/content boundary into the authoritative Research continuation; see [Cultist Research](cultist-research.md). That path uses ordinary-loss instructions and private Strength decisions rather than a monolithic raw kernel call. Possession/prevention, awakening and other Ancient Ones remain excluded.

TDD: timing RED8/10, GREEN10/10; validation RED6/16, GREEN16/16. Focused combat/Research104/104. Independent clean-context reviewer reported no actionable findings and independently passed22/22 combat cases. Full verification is recorded in the implementation journal.
