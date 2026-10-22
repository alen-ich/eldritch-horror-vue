# Cthulhu Cultist combat profile prerequisite

## Evidence and goal

Cthulhu Research 1 Wilderness/7 City are transcribed with Cultist ambushes, but the engine parser accepts only Deep One/Star Spawn. Ancient One data currently records toughness/effect IDs without combat checks. The local Cthulhu sheet was visually inspected: both sides omit Horror/Will combat, use Strength modifier 0 and Damage 1, and lose Sanity before the Strength test (1 front, 2 awakened). Toughness is 1 front/2 awakened. Existing effect IDs incorrectly say pre_will. No consumer references those IDs elsewhere in repository code. The image SHA256 matches recorded e408dceaf95bc679579b1e40d30bb688191ad06be80925d6efab24daadb8e77a.

## Scope and recommended design

First implement verified typed content, not live ambush execution. Add exported CultistCombatProfile with nullable horrorCheck (Will), nullable damageCheck (Strength), integer beforeStrengthSanityLoss. Reuse existing normal/awakened toughness fields rather than duplicate them. Add optional normalCombat/awakenedCombat fields to AncientOneData.cultist; require both canonical profiles for Cthulhu at validation, and reject unverified profiles on other Ancient Ones. Profiles use the scan values above; corrected effect IDs are cthulhu_cultist_pre_strength_sanity_loss_1/2.

Use strict schemas for nested profiles/checks and compare Cthulhu values/toughness/effect IDs against verified print. Wrong skill, extra keys, malformed numbers, missing profiles or mismatched values must fail validation. Existing export-star barrel already exports the new type; do not edit its dirty foundation.

Alternative: enable Cultist combat now. Rejected for this iteration because null-Horror sequencing, pre-Strength loss/defeat, rerolls, restoration and Ancient One selection need their own engine slice. Another alternative is more free-form effect IDs without numeric checks; that leaves the actual prerequisite unresolved and retains the timing transcription error.

## Boundaries and exclusions

Content-only prerequisite. Server authority and private state/network/public protocol are unchanged. Sheet statistics are already public artwork; no hidden information is introduced. No parser/engine handler, board combat, awakening flow, generic Cultist resolver, Mythos or readiness promotion. Other three Ancient Ones stay untranscribed for combat profiles. No package added. Existing content/rule files selected here are clean; preserve unrelated changes elsewhere.

## Acceptance and tests

New content tests pin front/back values and corrected Strength timing against the inspected sheet, verify source hash, accept canonical profiles, reject missing/wrong/malformed profile/check/legacy effect IDs or unverified-AO profiles. Monster catalog remains ancient_one placeholders. Existing Ancient One roster validation remains compatible. Run content tests plus relevant Research/ambush engine regression suites; then sequential root lint/typecheck/test/build, multiplayer and all three Playwright configs. One independent clean-context reviewer compares code, tests and source image before scoped commit.

## Self-review and approval

This single content prerequisite has clear rules provenance, strict failure boundaries, tests and exclusions. Self-reviewed with no ambiguity/placeholders. Self-approved under user delegation; proceed to writing-plans and inline TDD.
