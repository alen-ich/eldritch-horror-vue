# Base-game investigators

The structured roster in `packages/content/src/investigators.ts` was transcribed from the user-supplied `eldritch_horror_base_investigator_data.pdf`.

It contains all 12 investigators in that source, including stable IDs, occupation, Health, Sanity, five skills, starting location, starting equipment, role, and paraphrased action and passive abilities. Roles are descriptive UI labels rather than official game classes.

At game start, the authoritative engine applies each selected investigator's starting location, Health, Sanity, supported starting Assets and physical Clues. Norman additionally receives one physical Feed the Mind through the explicit `startingSpellIds` mapping, also on legal replacement when a copy is available in the supply. Other starting Spells and full investigator ability coverage remain incomplete; lobby reference text does not imply executable support.

## Norman's scoped passive ability (2026-10-21)

Within the Feed the Mind test only, Norman may spend 1 Sanity instead of 1 Clue for a reroll once per round, including with zero physical Clues. Sanity must remain positive. Usage is server-private and round-scoped; reconnect, another test or a different physical Spell does not restore it. The ordinary Clue payment remains available independently. Starting Feed the Mind is supported; Norman's action and substitution outside this Spell test remain unimplemented.

The printed ability was visually verified against FFG's [Norman investigator sheet](https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/Yogstrategy/EH01_Sheets_Character-19.jpg), SHA-256 `816efb19f43a1885544f77ab753a4ed28517d44b34330169b32a644829c9e2e6`, on 2026-10-21. The [official Reference Guide](https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/EH01%20Reference%20Guide.pdf), printed pages 7 and 11, separates spending from loss/prevention and forbids spending the final Sanity; printed page 13 explicitly permits Norman's substitution for test rerolls. The unavailable original local investigator-data PDF was not treated as reverified. The official published component and reference guide supplied the relevant rule evidence; no community interpretation was promoted to authority.

Run `pnpm content:validate` to check schema constraints, roster completeness, unique IDs, and source invariants such as the printed Health/Sanity and skill totals.
