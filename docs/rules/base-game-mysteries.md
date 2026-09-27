# Base-game Mystery reference

## Replacement status

The former Russian card scans, OCR catalog, generated browser assets, and Russian display metadata were removed on 2026-09-28. English Mystery scans have not yet been imported.

Expected English coverage is 16 base-game Mystery cards: four for each of Azathoth, Cthulhu, Shub-Niggurath, and Yog-Sothoth.

## Implemented content

`packages/content/src/mysteries.ts` provides:

- stable IDs and English titles for all 16 cards;
- a four-card deck association for each Ancient One;
- exact entry setup, progress trigger, costs, skill tests, end-of-Mythos completion threshold, and cleanup;
- stable references to named spaces, encounter decks, and Epic Monsters.

Validation rejects duplicate or incomplete rosters and requires exactly four Mysteries for each Ancient One.

## Authority boundary

The structured transcription is retained so the existing engine lifecycle continues to work, but the content family is now `needs_review`. It must not return to `verified` until all 16 English fronts are supplied, mapped to stable Mystery IDs, and checked against the structured setup, progress, completion, and cleanup data.

Game start creates a deterministic four-card deck for the selected Ancient One and keeps its remaining order in server-private state. The pure engine now owns the generic Mystery lifecycle: authoritative progress is capped at the content-defined target, a solved Mystery moves to the completed list, its replacement is drawn from the private deck, and the third solved Mystery produces the terminal investigator victory result. The room synchronizes only the active Mystery, progress, target, completed IDs, and terminal result; the web interface renders that projection without choosing outcomes.

This lifecycle is intentionally exposed as an internal engine operation rather than a client command. After English verification, the remaining work is to implement each card's entry effect and connect its progress/completion trigger to the correct authoritative encounter, combat, Mythos, or Ancient One timing point. Awakening-specific Final Mysteries remain part of Milestone 9.
