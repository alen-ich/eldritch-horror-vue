# Base-game Mystery reference

## Source

- File: `Eldritch_Horror_Base_Game_Mystery_Cards_RU.pdf`
- SHA-256: `f17958795136f3c2ed4fe5292a6c3296490e64328f0792d3aadce4113a5c2bd8`
- Supplied: 2026-09-27
- Coverage: 16 base-game Mystery cards, four for each base-game Ancient One

The source was text-extracted and every page was rendered for visual verification. It is a clean Russian-language reference document rather than card scans. Its own introduction describes each entry as a short mechanical summary and directs readers to their cards and the official Reference Guide for exact resolution.

All 16 corresponding Russian card fronts were subsequently identified in the existing 189-card scan bundle and visually verified. The scan mapping is:

- Azathoth: `card_025`, `card_026`, `card_027`, `card_171`
- Yog-Sothoth: `card_159` through `card_162`
- Cthulhu: `card_163` through `card_166`
- Shub-Niggurath: `card_167` through `card_170`

## Implemented content

`packages/content/src/mysteries.ts` provides:

- stable IDs plus English and Russian titles for all 16 cards;
- a four-card deck association for each Ancient One;
- exact entry setup, progress trigger, costs, skill tests, end-of-Mythos completion threshold, and cleanup;
- stable references to catalog cards, named spaces, encounter decks, and Epic Monsters;
- scan URL, per-image checksum, and an explicit `verified_from_scan` marker.

Validation rejects duplicate or incomplete rosters and requires exactly four Mysteries for each Ancient One.

## Authority boundary

The summary PDF alone was insufficient for executable resolution because it omitted setup quantities, costs, timing, and some thresholds. The card scans supply those details, so the Mystery content family is now `verified`.

Game start creates a deterministic four-card deck for the selected Ancient One and keeps its remaining order in server-private state. The pure engine now owns the generic Mystery lifecycle: authoritative progress is capped at the content-defined target, a solved Mystery moves to the completed list, its replacement is drawn from the private deck, and the third solved Mystery produces the terminal investigator victory result. The room synchronizes only the active Mystery, progress, target, completed IDs, and terminal result; the web interface renders that projection without choosing outcomes.

This lifecycle is intentionally exposed as an internal engine operation rather than a client command. The remaining work is to implement each verified card's entry effect and connect its progress/completion trigger to the correct authoritative encounter, combat, Mythos, or Ancient One timing point. Awakening-specific Final Mysteries remain part of Milestone 9.
