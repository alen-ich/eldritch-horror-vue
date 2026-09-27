# Base-game Mystery reference

## Source

- File: `Eldritch_Horror_Base_Game_Mystery_Cards_RU.pdf`
- SHA-256: `f17958795136f3c2ed4fe5292a6c3296490e64328f0792d3aadce4113a5c2bd8`
- Supplied: 2026-09-27
- Coverage: 16 base-game Mystery cards, four for each base-game Ancient One

The source was text-extracted and every page was rendered for visual verification. It is a clean Russian-language reference document rather than card scans. Its own introduction describes each entry as a short mechanical summary and directs readers to their cards and the official Reference Guide for exact resolution.

## Implemented content

`packages/content/src/mysteries.ts` provides:

- stable IDs and English lookup titles for all 16 cards;
- a four-card deck association for each Ancient One;
- structured high-level objective shapes such as collecting Clues, Gates, Eldritch tokens, or defeated Monsters;
- stable references to named spaces and Epic Monsters where the supplied summary identifies them;
- source page, source checksum, and an explicit `reference_summary_only` verification marker.

Validation rejects duplicate or incomplete rosters and requires exactly four Mysteries for each Ancient One.

## Authority boundary

This reference is sufficient to identify the deck roster and plan the engine vocabulary. It is not sufficient for executable card resolution because it omits exact setup quantities, encounter branches, costs, timing, and some completion thresholds. Mystery readiness is therefore `needs_review`, not `verified`.

The game engine must not infer omitted behavior from the Russian summaries. Exact card faces or another authoritative transcription are still required before Milestone 9 can implement and test all Mystery effects.
