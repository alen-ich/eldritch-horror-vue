# Base-game Ancient Ones

The four base-game Ancient One sheets are stored in `apps/web/public/ancient-ones/` and represented as validated structured data in `packages/content/src/ancient-ones.ts`.

| Ancient One | Starting Doom | Source SHA-256 |
| --- | ---: | --- |
| Cthulhu | 12 | `e408dceaf95bc679579b1e40d30bb688191ad06be80925d6efab24daadb8e77a` |
| Shub-Niggurath | 13 | `97c854976158540c0f66f107ffd95344151bb4427c3aa7664771503c5f4d4e8d` |
| Yog-Sothoth | 14 | `8eb06883e088b22b8007d3bdc7ddf0172a7e6fcef69b15e07e33dd68ba48bb9a` |
| Azathoth | 15 | `82ed63b0bfc31586b2e8ac2d3996a646c15528626105eff5fe56cfe1ae8900d1` |

Each record includes:

- stable ID, name, epithet, and starting Doom;
- green/yellow/blue counts for all three Mythos stages;
- typed setup instructions with stable component references;
- stable effect IDs for front, awakened, and Cultist rules;
- normal and awakened Cultist toughness where applicable;
- a structured Final Mystery or immediate-loss condition;
- browser image path and source checksum.

The Shub-Niggurath awakening effect matches the corrected wording identified by the supplied FAQ.

## Initial implementation (historical)

- The host selects the Ancient One in the lobby through a runtime-validated command.
- The server authorizes and synchronizes the selection.
- A game cannot start until an Ancient One has been selected.
- Sheet effects are modeled as stable IDs but are not yet executed.

## Initial dependencies (historical)

Ancient One setup cannot fully resolve until referenced Monster tokens and Special Encounter decks have structured stable IDs. The separate Mystery decks are also still required; the Final Mystery printed on an Ancient One's back does not replace its normal Mystery deck.

## Cthulhu Cultist combat profiles — 2026-10-23

The local sheet and its recorded checksum were rechecked. Both Cultist sides have no Horror/Will check, Strength modifier 0 and Damage 1. Before the Strength test, lose 1 Sanity on the front or 2 on the awakened side; toughness is respectively 1 or 2. The former pre_will effect IDs were a transcription error and are corrected to pre_strength. No repository consumer used the old IDs.

Typed normalCombat/awakenedCombat profiles now preserve these values. Strict catalog validation requires both exact Cthulhu profiles and their existing toughness/effect IDs; profiles for the other Ancient Ones remain unverified and reject rather than inherit Cthulhu defaults. This is public descriptive content only: Monster attributes still reference ancient_one, Cultist ambush/board combat stays guarded, and no readiness or awakening support is promoted.

Next dependency: an authoritative Ancient One-aware resolver with null-Horror sequencing and pre-Strength Sanity loss/defeat before enabling Cthulhu Research 1 Wilderness/7 City. Other Ancient One profiles and their special text need separate scan verification. Detailed evidence/checks: docs/superpowers/plans/2026-10-23-cthulhu-cultist-profile.md.
