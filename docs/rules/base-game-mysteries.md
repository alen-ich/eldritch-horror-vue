# Base-game Mystery reference

## Replacement status

The former Russian card scans, OCR catalog, generated browser assets, and Russian display metadata were removed on 2026-09-28. English artwork is now registered for all 16 base-game Mystery cards: four for each of Azathoth, Cthulhu, Shub-Niggurath, and Yog-Sothoth.

The replacement source set contains all 16 distinct base-game fronts. Eight expansion Mystery fronts found in the earlier sheets were removed from the source and generated asset sets.

## Implemented content

`packages/content/src/mysteries.ts` provides:

- stable IDs and English titles for all 16 cards;
- a four-card deck association for each Ancient One;
- a browser image URL and the matching Ancient One back for every card;
- exact entry setup, progress trigger, costs, skill tests, end-of-Mythos completion threshold, and cleanup;
- stable references to named spaces, encounter decks, and Epic Monsters.

Validation rejects duplicate or incomplete rosters and requires exactly four Mysteries for each Ancient One.

## Authority boundary

The structured transcription and artwork mapping are `verified`. Content validation requires exactly the 16 base-game IDs and four Mysteries per Ancient One; asset tests require every registered front and back to exist, and all 16 fronts are generated from the current English source scans.

Game start creates a deterministic four-card deck for the selected Ancient One and keeps its remaining order in server-private state. The pure engine now owns the generic Mystery lifecycle: authoritative progress is capped at the content-defined target, a solved Mystery moves to the completed list, its replacement is drawn from the private deck, and the third solved Mystery produces the terminal investigator victory result. The room synchronizes only the active Mystery, progress, target, completed IDs, and terminal result; the web interface renders that projection without choosing outcomes.

This lifecycle is intentionally exposed as an internal engine operation rather than a client command. The remaining work is to implement each card's entry effect and connect its progress/completion trigger to the correct authoritative encounter, combat, Mythos, or Ancient One timing point. Awakening-specific Final Mysteries remain part of Milestone 9.
