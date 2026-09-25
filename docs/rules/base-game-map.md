# Base-game map topology

The structured map in `packages/content/src/map.ts` was transcribed from the user-supplied `eldritch_horror_map_data_routes_compatible.pdf`.

It contains:

- 36 spaces: 15 named spaces and 21 numbered spaces;
- each space's city, wilderness, or sea classification;
- 70 unique undirected routes;
- 11 train, 29 ship, and 30 uncharted routes.

The PDF defines topology but not application coordinates. The `x` and `y` values are presentation metadata chosen for the prototype SVG and are not rules data. Movement legality is derived only from the typed route list on the authoritative server.

Run `pnpm content:validate` to check IDs, references, duplicate routes, route totals, and representative node degrees.
