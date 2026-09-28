# Base-game Condition scans

The supplied English sheets contain all **36 physical base-game Conditions**. Their printed front order is 32 cards on `front-1.jpg` and four on `front-2.jpg`; the two back sheets use the same row/column order. There are six Debt cards and three each of Amnesia, Dark Pact, Leg Injury, Internal Injury, Paranoia, Cursed, Hallucinations, Detained, Blessed, and Back Injury.

`packages/content/src/conditions.ts` assigns a stable ID to every physical copy, records the front name, trait, and mechanical summary, and preserves the source sheet and slot. `pnpm conditions:generate` creates 36 front crops at `apps/web/public/cards/conditions/` and 36 paired back crops at `apps/server/private-card-assets/conditions/`. The back crops must **not** be moved into `apps/web/public` or synchronized to other players. If a card flips during play, the server must authorize the reveal and send only the resulting owner-visible information.

This is a verified artwork/catalog import, **not a playable Condition implementation**. The distinct reverse texts, flip triggers, Blessing/Curse thresholds, Deal interactions, and other card effects still need typed transcription, deterministic engine resolution, and multiplayer tests. Until that work is complete, the content remains `needs_review` and `not_executable`.
