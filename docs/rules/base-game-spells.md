# Base-game Spell scans

The supplied English sheets contain all **20 physical base-game Spells**, with matching fronts and distinct backs in a shared four-column, five-row order. There are two copies each of Instill Bravery, Blessing of Isis, Shriveling, Clairvoyance, Feed the Mind, Flesh Ward, Plumb the Void, Wither, Conjuration, and Mists of Releh.

`packages/content/src/spells.ts` records a stable ID per physical copy, the printed name and trait, front timing, Lore-test modifier, and front effect summary. `pnpm spells:generate` crops 20 front images into `apps/web/public/cards/spells/` and 20 corresponding back images into `apps/server/private-card-assets/spells/`. The reverse images are deliberately not published to web static assets: many show variable outcomes after a Spell flips and should be revealed only by the authoritative server.

This is a scan-verified artwork and front-catalog import, **not an executable Spell implementation**. Each distinct back still needs exact typed outcome transcription; action, reaction, once-per-round, and encounter timing need engine support and multiplayer tests. The cards remain `needs_review` and `not_executable` until then.
