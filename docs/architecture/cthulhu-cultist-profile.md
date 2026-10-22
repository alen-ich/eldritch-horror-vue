# Verified Cthulhu Cultist content prerequisite

2026-10-23: CultistCombatProfile adds explicit nullable Will/Horror and Strength/Damage checks plus beforeStrengthSanityLoss to optional AncientOneData.cultist profiles. Cthulhu front/back are verified from apps/web/public/ancient-ones/cthulhu.jpg (SHA256 e408dceaf95bc679579b1e40d30bb688191ad06be80925d6efab24daadb8e77a): no Horror, Strength0/Damage1, loss1/2 before Strength, existing toughness1/2. Corrected the unused pre_will metadata identifiers to pre_strength.

Strict schema and canonical catalog checks reject incomplete/malformed/mismatched Cthulhu profiles, old timing IDs and unverified profiles on other Ancient Ones. Existing export-star exposes the type without changing the already-dirty barrel. No hidden data, network/engine API, executable effect, dependency or readiness change. The Monster catalog retains all ancient_one placeholders.

TDD RED2/39 (base metadata absent/wrong timing and positive new schema rejected), GREEN39/39 new and55/55 related content cases. Source image visually inspected, checksum independently checked by a test. Full checks, independent source comparison and execution journal: docs/superpowers/plans/2026-10-23-cthulhu-cultist-profile.md.

At completion of the content prerequisite, the encounter parser excluded Cultist and the ambush preflight required a non-null Horror check. The content iteration did not activate execution.

Follow-ups: the separately tested raw combat timing primitive is implemented; see [pre-Strength loss](pre-strength-loss.md). Normal Cthulhu Research profile consumption is now implemented through the interruptible continuation; see [Cultist Research](cultist-research.md) for scope and remaining possession/awakening exclusions.
