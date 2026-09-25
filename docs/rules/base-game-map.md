# Base-game map topology

The structured map in `packages/content/src/map.ts` was transcribed from the user-supplied `eldritch_horror_map_data_routes_compatible.pdf`.

It contains:

- 36 spaces: 15 named spaces and 21 numbered spaces;
- each space's city, wilderness, or sea classification;
- 70 unique undirected routes;
- 11 train, 29 ship, and 30 uncharted routes.

The PDF defines topology but not application coordinates. The `x` and `y` values are presentation metadata chosen for the prototype SVG and are not rules data. Their `positionSource` remains `prototype-layout`; they must not be represented as coordinates measured from the printed board. Named spaces also carry approximate geographic references for projection and future registration work. Movement legality is derived only from the typed route list on the authoritative server.

The decorative Earth layer is generated from public-domain Natural Earth 1:110m geometry. Run `pnpm map:generate` to reproduce `apps/web/public/map/earth-background.svg`. The generator uses a Natural Earth projection fitted to the board's `680 × 460` view box; see `docs/attributions/natural-earth.md` for provenance.

The web board layers the Earth, typed routes, locations, investigator tokens, and effects separately. It provides focus/hover inspection, highlighted legal routes, bounded zoom controls, token transitions, and reduced-motion support. Decorative geography never participates in movement validation.

An exact `registered-scan` position requires a flat board scan that the project is authorized to use. Until one is supplied, do not claim that the prototype coordinates were extracted from the copyrighted printed artwork.

Run `pnpm content:validate` to check IDs, references, duplicate routes, route totals, and representative node degrees.
