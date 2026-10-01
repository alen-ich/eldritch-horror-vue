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

This import removes the source-scan dependency, not the engine dependency. New encounter records remain `not_executable`, Artifacts remain `transcribed_pending_execution`, and both readiness families remain `needs_review`. They are not added to live engine draws in this import.

Next: transcribe Research instructions by Ancient One and location type; connect supported Research outcomes to the exact board Clue encountered, including failed retention, relocation, and discard. Then model the shared complex-encounter Initial/Pass/Fail lifecycle with nested tests and choices; wire Other World Gate closure, Expedition relocation, Special Mystery/Ancient One progress, and Artifact gain/effects. Add deterministic rules and multiplayer tests per vertical slice before enabling commands. No further scans in these five categories are currently needed.

Tests enforce base-only counts, complete numbering, crop readability, source/back availability, special Himalayas mapping, duplicate rejection, canonical metadata, and explicit non-executable status.
