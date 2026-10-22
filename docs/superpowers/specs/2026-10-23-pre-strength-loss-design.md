# Ordered pre-Strength Sanity loss in the pure combat kernel

## Goal and evidence
The verified Cthulhu Cultist profiles require Sanity loss immediately before Strength and no Will test. `resolveStandardCombat` already accepts a null Horror check but cannot express this timing. This is a separately testable prerequisite for Research Cultist ambush, not activation of that encounter.

## Scope and architecture
Extend `StandardCombatInput` with optional `beforeStrengthSanityLoss: number`, default zero. Require a nonnegative integer before any RNG consumption. After surviving Horror, if a Damage/Strength check exists, apply the loss capped by remaining Sanity. Defeat stops before Strength and gives no Monster damage. Otherwise preserve the existing Strength calculation and simultaneous damage behavior. Result `sanityLost` reports total Horror plus pre-Strength loss. With no Strength check, the timing never occurs.

The caller supplies typed primitives; engine imports no content, framework or transport. The kernel calculates raw losses only, just as its existing Horror calculation does. Live ordinary-loss prevention, private decisions, defeat state transitions and rerolls remain the responsibility of the authoritative command interpreter. No network input, hidden state, physical Monster pools or public projections change.

## Alternatives
Recommended: a backward-compatible timing input in the existing kernel, reusing its validation and defeat boundary. A Cthulhu-only wrapper would duplicate combat validation and couple generic mechanics to an Ancient One. Enabling the full Research interpreter now would combine profile mapping, restoration, prevention and private choice ownership; that is a subsequent vertical slice requiring its own tests.

## Acceptance and exclusions
Tests prove no Will RNG with null Horror; exact one/two point loss; clamping and zero Strength RNG on lethal loss; Horror then loss then Strength; no trigger without Strength; zero/default compatibility; invalid values rejected before RNG; simultaneous Health/Monster damage after surviving the loss. Frozen caller data remains unchanged. Existing combat and Research tests remain green.

No awakening, other Ancient Ones, possession support, board combat, prevention simulation, readiness promotion or new packages. This helper must not be used to bypass the live ambush guards.

## Review
Self-reviewed and approved under the user's delegated approval: scope, authority, timing, null-check behavior and explicit exclusions are consistent. Full written plan follows before implementation.
