# Research, complex encounters, and Artifact scans

The newly supplied English scans have all remaining base-game card faces and shared backs:

| Family | Fronts | Distinct backs | Grouping |
| --- | ---: | ---: | --- |
| Research | 32 | 4 | 8 each for Azathoth, Cthulhu, Shub-Niggurath, Yog-Sothoth |
| Other World | 24 | 1 | One shared deck |
| Expedition | 18 | 6 | 3 each for Heart of Africa, Himalayas, Amazon, Tunguska, Antarctica, Pyramids |
| Special | 12 | 2 | 6 R'lyeh Risen and 6 The Key and the Gate |
| Artifact | 14 | 1 | One shared deck |

`packages/content/src/remaining-card-scans.json` is the explicit visual import map shared by the content catalog and `pnpm remaining-cards:generate`. Numbers are printed card numbers, not source positions; the Himalayas front is ordered 2, 1, 3. Source misspellings such as `yog-sogoth` are retained as filenames but normalized to canonical `yog_sothoth` IDs. Individual Expedition group scans are canonical; duplicate combined `front-1.jpg`/`front-2.jpg` sheets are retained unchanged and are not imported twice.

Generated files live under `apps/web/public/cards/encounters/<deck>/` and `apps/web/public/cards/artifacts/`. These backs are shared deck-identification artwork, unlike private Spell/Condition reverse outcomes. Public image availability does not authorize synchronizing undrawn deck order or automatically resolving cards.

`token-encounters.ts` catalogs 86 faces with family, deck, printed number, section structure, display title, source sheet/cell, paired back, and stable image paths. Research sections are City/Wilderness/Sea; complex encounters are Initial/Pass/Fail. `artifacts.ts` catalogs all 14 Artifact names, printed traits, and mechanical-text transcriptions, replacing skill icons with their names. No free-form text is interpreted at runtime.

## Execution status and next implementation

Research preparation: internal `resolveBoardClueEffect` supports relocating the exact opaque marker while preserving its private physical identity, or returning that exact token to the discard supply. It rejects missing tokens, invalid destinations, ended games, and non-Encounter phases atomically. This is not a client command or a Research card handler; failed encounters that retain a Clue make no token transition. Tests cover multiple Clues on one space, identity preservation, duplicate discards, and public privacy.

This import removes the source-scan dependency, not the engine dependency. New encounter records remain `not_executable`, Artifacts remain `transcribed_pending_execution`, and both readiness families remain `needs_review`. They are not added to live engine draws in this import.

`research-encounter-rules.ts` transcribes all eight Azathoth Research cards (24 City/Wilderness/Sea sections), with strict schemas and scan-linked canonical validation. The encountered physical Clue is a distinct effect from additional supply Clues. Unconditional collection precedes tests on cards 2 Sea, 3 Wilderness, 5 Wilderness, and 8 Sea; card 8 Wilderness loses Health before testing. Omen movement without Doom, green Omen Eldritch placement, chosen Omen Eldritch removal, random solved-Mystery return, and the optional Dark Pact for the named T'tka Halot Artifact are explicitly recorded. Family metadata remains `transcribed_pending_execution` because coverage is partial; the executable subset is described below. The other three Ancient Ones' 24 Research cards remain to transcribe.

Next: transcribe Research instructions by Ancient One and location type; connect supported Research outcomes to the exact board Clue encountered, including failed retention, relocation, and discard. Then model the shared complex-encounter Initial/Pass/Fail lifecycle with nested tests and choices; wire Other World Gate closure, Expedition relocation, Special Mystery/Ancient One progress, and Artifact gain/effects. Add deterministic rules and multiplayer tests per vertical slice before enabling commands. No further scans in these five categories are currently needed.

Tests enforce base-only counts, complete numbering, crop readability, source/back availability, special Himalayas mapping, duplicate rejection, canonical metadata, and explicit non-executable status.

## Guarded Research engine slice

The authenticated `RESOLVE_RESEARCH_ENCOUNTER` command accepts only an opaque on-space Clue marker ID. Setup shuffles the selected Ancient One's available Research catalog into a private deck. Currently only Azathoth has transcribed rules; 22 of its 24 sections are executable. Card 5 City (random solved-Mystery return) and Card 5 Sea (optional Dark Pact/named Artifact) remain unsupported. The entire selected section is checked before rolling or consuming components. Carried Assets are still blocked pending encounter possession bonuses.

Supported sections reuse the ordered location instruction continuation, physical Condition/damage/Delay/spawn effects, and owner-only test rerolls. `encountered_clue` binds to the chosen exact marker; extra Clues draw from supply independently. Failed tests leave uncollected Clues on the board. An unconditional Clue grant before a test makes that token immediately available to reroll that later test. The card stays on top while decisions are pending, cycles once on completion or defeat, and advances the encounter seat after the existing defeat lifecycle. Only the current/last revealed card and public marker state synchronize; the queue, physical identities, and undrawn order remain private.

The browser exposes Research buttons for on-space markers and displays the revealed Research artwork. Unsupported sections report an error without changing the card or Clue. Engine tests cover exact-token conservation, retention, modifiers, prefix ordering, serializable owner-only rerolls, deck cycling, unsupported preflight, and authorization. A two-player room test verifies command ownership, hidden data, continuation round trips, and phase handoff. The existing multiplayer browser journey also passes; it is not a dedicated Research browser test.

Research Omen movement uses the shared owner-only Encounter choice with four physical destinations, including both blue spaces and the current space. It never advances Doom or triggers Azathoth's advance-only green effect. Printed advancement reuses the same internal resolver as Mythos: matching Gates plus Azathoth's green Eldritch tokens count on entering green, with immediate defeat at zero Doom. The exported Mythos operation still rejects Encounter timing. Placement increases `greenOmenTokens` by one without immediate Doom loss. Removal discards one from green, or does nothing at zero; every modeled base Azathoth source places Omen Eldritch tokens on green, so it is the only occupied space and no selection is needed. Generalized token placement on other Omen spaces is not modeled. Tests cover these distinctions, zero-token removal, invalid Omen state, game-ending advancement, and owner-only serialized multiplayer choices.
