# Base-game map topology

The structured map in `packages/content/src/map.ts` was transcribed from the user-supplied `eldritch_horror_map_data_routes_compatible.pdf`.

It contains:

- 36 spaces: 15 named spaces and 21 numbered spaces;
- each space's city, wilderness, or sea classification;
- 70 unique undirected routes;
- 11 train, 29 ship, and 30 uncharted routes.

The PDF defines topology but not application coordinates. The user-supplied board scan is stored at `apps/web/public/map/eldritch-board.webp` and registered at its native `1920 × 1264` resolution. Every location's `x` and `y` value targets the center of its printed space marker and has `positionSource: "registered-scan"`. These coordinates are presentation metadata, not rules data. Movement legality is derived only from the typed route list on the authoritative server.

The earlier public-domain Natural Earth layer remains available as a reproducible fallback. Run `pnpm map:generate` to rebuild `apps/web/public/map/earth-background.svg`; see `docs/attributions/natural-earth.md` for provenance. It uses its own `680 × 460` projection and therefore must not be combined with the registered scan coordinates without transforming them.

The web board layers the supplied scan, typed routes, transparent location hit areas, investigator tokens, and effects separately. Printed labels and routes remain unobscured; interactive overlays become prominent only for inspection and legal movement. It provides keyboard focus, hover inspection, highlighted legal routes, bounded zoom controls, token transitions, and reduced-motion support. The scan and its coordinates never participate in server movement validation.

Run `pnpm content:validate` to check IDs, references, duplicate routes, route totals, and representative node degrees.
