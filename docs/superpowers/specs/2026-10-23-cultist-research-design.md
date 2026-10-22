# Normal Cthulhu Cultist Research ambush

## Goal and evidence
Enable authored Research1 Wilderness and7 City with the verified normal Cthulhu Cultist profile. Current parser excludes Cultist, preflight requires printed non-null Horror, and server mapping omits the Ancient One profile. The verified source/content prerequisite is documented in `docs/architecture/cthulhu-cultist-profile.md`.

## Design and alternatives
Recommended: resolve named ambush statistics in one pure engine helper, used by preflight and queue expansion. Transfer optional normal Cultist primitives through existing `AncientSetup` server mapping. Require Cthulhu, not awakened, exact verified profile/effect ID and unchanged Cultist placeholders; reject missing/extra/unsupported attributes. Keep Deep One/Star Spawn checks equivalent. Do not infer unknown stats.

Expand Cultist into ordinary Sanity loss1 then the existing Strength test0 and ambush_result Damage1/toughness1. Null Horror means no Will RNG or private choice. Existing ordinary-loss handler stops on defeat before Strength and rejects unsupported awakening. Existing Strength decision/reroll, parent branches, physical Research draw/discard, marker binding, rollback and projection remain authoritative. Revalidate Cultist nodes in restored private queues before resolving decisions. The raw monolithic combat kernel is unsuitable for interruptible private decisions, so is not called.

Alternatives: a new full combat subsystem duplicates existing command lifecycle; allowing arbitrary Ancient One stats or possession effects would silently exceed verified rules. Neither is needed.

## Boundaries and exclusions
Pure engine imports types/primitives only. Server content remains trusted and private; clients retain existing intents and owner checks. No new protocol, hidden projection, packages, physical Monster movement or readiness promotion. Broad possession/aura/prevention guards remain unchanged: even a colleague's applicable prevention causes rejection before draw/loss/RNG. This does not claim prevention execution, awakened Cultist, other Ancient Ones or generic board combat.

## Acceptance
Deterministic tests cover both cards' success/failure branches; Sanity loss before first Strength choice and exactly once after JSON restoration; lethal loss with no dice/branch effects; no Will; owner-only reroll and private projection; rollback on insufficient RNG; guards for missing/malformed profile, awakening, other AO and possessions/prevention; unchanged physical Monster pools; server real-room restoration/privacy. Existing Research/combat tests plus all root and browser checks pass.

## Approval
Self-reviewed and approved under delegated user authority: minimal normal-only scope, explicit guarded exclusions, no invented rules. Written implementation plan follows before code.
