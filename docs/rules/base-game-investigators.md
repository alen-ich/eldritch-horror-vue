# Base-game investigators

The structured roster in `packages/content/src/investigators.ts` was transcribed from the user-supplied `eldritch_horror_base_investigator_data.pdf`.

It contains all 12 investigators in that source, including stable IDs, occupation, Health, Sanity, five skills, starting location, starting equipment, role, and paraphrased action and passive abilities. Roles are descriptive UI labels rather than official game classes.

At game start, the authoritative engine currently applies each selected investigator's starting location, Health, and Sanity. Equipment and ability text are visible in the lobby as reference data, but their rule effects are not executed yet.

Run `pnpm content:validate` to check schema constraints, roster completeness, unique IDs, and source invariants such as the printed Health/Sanity and skill totals.
