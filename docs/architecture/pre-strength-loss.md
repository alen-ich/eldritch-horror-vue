# Pure pre-Strength Sanity-loss prerequisite

2026-10-23: `StandardCombatInput.beforeStrengthSanityLoss` optionally supplies a nonnegative integer raw loss, default zero. The pure kernel resolves Horror first, then this loss only before an existing Strength check. Total Sanity loss is capped at current Sanity; defeat ends combat before Strength RNG or Monster damage. Surviving investigators retain the existing Strength and simultaneous Health/Monster damage calculation.

This represents the timing needed by the verified Cthulhu Cultist profiles without importing content. It is a calculation primitive, not an ordinary-loss prevention or authoritative command interpreter. No live Cultist parser/preflight guards, private continuations, rerolls, physical Monster pools, readiness or network projections changed. The optional field is already exposed by the existing combat export.

Next dependency: map the verified normal Cthulhu profile through the server/content boundary and integrate ordered loss into the existing authoritative Research continuation. That slice must test ordinary loss/prevention, lethal loss before RNG, owner-only rerolls, parent branches, restoration, rollback and unchanged physical pools. Do not replace those transitions with a monolithic raw kernel call or bypass possession/Ancient One guards. Awakening and other Ancient Ones remain excluded.

TDD: timing RED8/10, GREEN10/10; validation RED6/16, GREEN16/16. Focused combat/Research104/104. Independent clean-context reviewer reported no actionable findings and independently passed22/22 combat cases. Full verification is recorded in the implementation journal.
