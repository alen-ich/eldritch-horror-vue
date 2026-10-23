# Base-game investigators

The structured roster in `packages/content/src/investigators.ts` was transcribed from the user-supplied `eldritch_horror_base_investigator_data.pdf`.

It contains all 12 investigators in that source, including stable IDs, occupation, Health, Sanity, five skills, starting location, starting equipment, role, and paraphrased action and passive abilities. Roles are descriptive UI labels rather than official game classes.

At game start, the authoritative engine applies each selected investigator's starting location, Health, Sanity, supported starting Assets and physical Clues. Norman additionally receives one physical Feed the Mind through the explicit `startingSpellIds` mapping, also on legal replacement when a copy is available in the supply. Other starting Spells and full investigator ability coverage remain incomplete; lobby reference text does not imply executable support.

## Norman's scoped passive ability (2026-10-21)

Within a Feed the Mind test, Norman may spend 1 Sanity instead of 1 Clue for a reroll once per round, including with zero physical Clues. Sanity must remain positive. Usage is server-private and round-scoped; reconnect, another test or a different physical Spell does not restore it. The ordinary Clue payment remains available independently. Starting Feed the Mind and Norman's own action are supported; the action shares this usage as described below. Substitution in other contexts remains unimplemented.

The printed ability was visually verified against FFG's [Norman investigator sheet](https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/Yogstrategy/EH01_Sheets_Character-19.jpg), SHA-256 `816efb19f43a1885544f77ab753a4ed28517d44b34330169b32a644829c9e2e6`, on 2026-10-21. The [official Reference Guide](https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/EH01%20Reference%20Guide.pdf), printed pages 7 and 11, separates spending from loss/prevention and forbids spending the final Sanity; printed page 13 explicitly permits Norman's substitution for test rerolls. The unavailable original local investigator-data PDF was not treated as reverified. The official published component and reference guide supplied the relevant rule evidence; no community interpretation was promoted to authority.

Run `pnpm content:validate` to check schema constraints, roster completeness, unique IDs, and source invariants such as the printed Health/Sanity and skill totals.

## Norman's action and shared payment (2026-10-21)

Norman's own action now spends 2 physical Clues to discard one non-Epic Monster on any space containing an active Gate, regardless of Norman's location. The owner selects a public Monster instance and either the ordinary price or 1 Clue plus 1 Sanity. The latter uses the same private once-per-round substitution as Feed the Mind rerolls; using either context blocks the other until the next round. The final Sanity cannot be spent. The earlier scoped-passive section describes the previous implementation boundary; action payment is now the second supported context. Other Clue-spending contexts remain unsupported.

An accepted command pays and removes the target atomically, charges one investigator action, returns the physical Monster to its randomized cup (or its set-aside reserve), and keeps the Gate open. This is discard, not defeat or a Combat Encounter, and grants no combat reward. The server validates current ownership, turn, target, Gate, physical payment and supply; invalid or stale input does not pay. The private ledger, Clue identities and cup order do not synchronize. Restoring or reconnecting does not replenish usage.

Reference Guide printed pages 5, 7–8, 11 and 13 supply discard, spend and Norman substitution rules. See `docs/superpowers/specs/2026-10-21-norman-action-design.md` and the matching execution plan for scope, tests and actual verification results. Investigator-family readiness remains incomplete.

## Norman's Acquire Assets reroll (2026-10-21)

Acquire Assets now offers Norman the same once-per-round 1-Sanity-for-1-Clue substitution to reroll one Influence die, even with zero physical Clues. It shares the private round ledger with Feed the Mind and his investigator action. The final Sanity cannot be spent; physical Clues are unchanged by the alternative, and ordinary Clue payments remain available independently. Purchase strength is recomputed by the existing test rules. Payment is spending, not damage.

Only the owner receives payment choices; public Sanity and test results synchronize normally. Reload/reconnect restores the pending option without replenishing usage. Marked acquisition snapshots validate the regenerated choices before restoration, and rejected deterministic-input commands roll back retained queues. Trish's applicable same-space two-die interaction fails before dice/payment until implemented. Other test continuations and Clue-spending contexts remain unsupported; no full investigator-family readiness is claimed. See `docs/superpowers/plans/2026-10-21-norman-acquire-reroll.md` for actual checks and limitations.
