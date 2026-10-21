# Base-game Spell scans

The supplied English sheets contain all **20 physical base-game Spells**, with matching fronts and distinct backs in a shared four-column, five-row order. There are two copies each of Instill Bravery, Blessing of Isis, Shriveling, Clairvoyance, Feed the Mind, Flesh Ward, Plumb the Void, Wither, Conjuration, and Mists of Releh.

`packages/content/src/spells.ts` records a stable ID per physical copy, the printed name and trait, front timing, Lore-test modifier, and front effect summary. `pnpm spells:generate` crops 20 front images into `apps/web/public/cards/spells/` and 20 corresponding back images into `apps/server/private-card-assets/spells/`. The reverse images are deliberately not published to web static assets: many show variable outcomes after a Spell flips and should be revealed only by the authoritative server.

This is a scan-verified artwork and front-catalog import, **not a complete executable Spell family**. All 20 distinct backs now have verified server-private descriptive transcriptions; action, reaction, once-per-round, reverse execution and encounter timing still need engine support and multiplayer tests. The cards remain `needs_review` and `not_executable` until then.

## Physical inventory foundation (2026-10-15)

The engine initializes one combined 20-copy private Spell inventory after existing setup randomness. `PrivateGameState.spells` stores the ordered supply, seat holdings and defeated-investigator holdings. Inventory operations check exact conservation and prevent duplicate held kinds. An accounted empty supply is valid; corrupt or missing inventory is rejected rather than regenerated. Defeat caches physical copies; replacement starts empty.

The [official Reference Guide](https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/EH01%20Reference%20Guide.pdf), printed pages 5–7 and 11, supplies the draw/search/duplicate/discard/privacy rules used by the tests. The array is top-first; random draws remove the bottom. Discards immediately rejoin the shuffled deck, with no separate discard pile. Random duplicates return and retry when an unowned kind is available. Named duplicates retain the original copy; trait searches exclude held kinds. Named/trait searches run bottom-first and shuffle afterward. Injected shuffling represents the physical shuffle/cut.

`gainSpell` and `discardSpell` are internal, version-neutral helpers; the outer command owns the single canonical version increment. Legal depletion succeeds without a gain. Random input failure rejects without publishing partial state. No network command grants or trades Spells. The scoped Feed the Mind cast intent is described below.

Only front-kind IDs such as `spell_wither` synchronize, including on defeated sheets and the supply's visible top. Inventory uses the same canonical front artwork for both copies. Hidden copy IDs, reverse paths and remaining supply order never synchronize. Room restoration validates before mutation and clones private snapshots. The Spells tray shows holdings and supply top with “Effects not implemented,” without action controls.

### Conservative effect guards

| Resolution | Unimplemented effects guarded before resolution |
| --- | --- |
| Location/Research | Investigator's Encounter/combat Spells and any living holder's Health/Sanity protection |
| Other World | Investigator's Encounter Spells and any living holder's Health/Sanity protection |
| Board combat | Investigator's combat/Encounter Spells and any living holder's Health/Sanity protection |
| Mythos draw/icon progression | Any living holder's Health/Sanity protection |
| Resumed encounter/Mythos choices | Recheck relevant holdings before continuing |
| Ordinary damage | Matching protection from any living holder, including remote colleagues |
| Travel, tickets, ending actions, Ritual inventory in ordinary tests | No blanket possession block |

Encounter guards are conservative when a branch could require an unsupported reaction. Costs that spend resources remain distinct from preventable loss. Starting Spell grants, casting/reverse outcomes, trade, reward encounters and full-family readiness remain pending; Other World cards 1, 6 and 20 are still guarded. Tests cover inventory, duplicate/depletion rules, projections, real room restoration/reconnect and the browser supply view. Held-card DOM rendering has no dedicated browser scenario; actual held synchronization is tested at the room boundary.

## Private reverse catalog (2026-10-20)

All 20 paired reverse crops have now been visually transcribed into `apps/server/src/private-spell-backs.ts`, with source-linked regression fixtures and SHA-256 checks for the two source sheets and 20 reverse crops. Internal copy IDs retain the existing sheet-slot mapping; printed card numbers are recorded separately because some pairs appear in reverse printed-number order. Printed Strength icons are represented as `[Strength]`; line wrapping and typography are normalized without changing the wording.

The catalog describes success-count branches, ordered printed instructions and the common final flip instruction. It is data only: no casting, reverse execution or reveal is enabled. The server-local validator rejects incomplete catalogs, invalid pairings, malformed ranges and executable/unknown fields. Private data is not imported by the room or shared content package; tests and a build-artifact check enforce that boundary.

`backTextStatus` is now `verified`; `effectStatus` remains `not_executable` and Spell readiness remains `needs_review`. Existing guards, starting-grant restrictions and Other World cards 1, 6 and 20 remain unchanged. The next separate slice should select one Spell kind and specify its full casting/test/flip semantics and both reverse outcomes before enabling it. Public notes intentionally omit hidden texts and copy-to-outcome tables.

## Feed the Mind casting (2026-10-20)

Both physical copies now have server-private typed handlers for the full front/test/reverse lifecycle. This is scoped support for one kind, not full-family readiness. Starting Spell grants (including Norman), reward encounters, trading, other Spell effects, and Other World cards 1, 6 and 20 remain disabled. Ordinary setup therefore does not yet supply a castable Spell; tests use conserved internal gains on an isolated fixture server.

The strict `CAST_SPELL` intent identifies only `spell_feed_the_mind`. The room derives caster/source; Lore -1 uses authoritative tests, physical Clue rerolls, supported free rerolls and die modification, Arcane Manuscripts' Spell-only bonus, City auras and Blessed/Cursed thresholds. Final dice determine reverse outcomes. Caster chooses a same-space recipient; that recipient owns skill choices, including Lily's optional doubled improvement and +2 caps. Unsupported applicable protection/substitution effects reject before rolling, including Trish's unimplemented two-die Clue aura when relevant.

Private state stores the pending source and component usage. An accepted cast reserves one action until completion and consumes that physical component's use for the round, even after discard/reacquisition. Recipient reload/reconnect restores the owner-only decision. Ordinary Sanity loss can defeat the caster; completion clears the cast and charges once without advancing through unresolved defeat. Deterministic input checkpoints roll back rejected Spell commands.

Only front availability and public consequences synchronize. No physical-copy ID, reverse table/text or image path is sent; selected effects use generic owner choices. Engine, room and browser regressions cover casting and recipient restoration; source mapping is verified against both existing reverse crops. The browser case covers retained-card optional improvement/decline, while discard and loss/defeat branches have engine coverage. Family readiness stays `needs_review`; only Feed the Mind is `scoped_executable`.

## Norman's scoped Spell reroll payment (2026-10-21)

Norman can now cast a held Feed the Mind and, once per round, choose to spend 1 Sanity instead of 1 Clue for one die reroll in that test. No physical Clue is required for this alternative; spending the last Sanity is prohibited. The payment is a spend, not preventable damage. Later reverse losses retain normal defeat handling. Real Clue payments, supported free rerolls and die modifications remain separate choices.

The private investigator-ability ledger survives command copies, room snapshots, disconnect/reconnect, and a change of physical Spell copy. It resets at the new-round transition, separately from component use. Snapshot validation rejects missing new ledgers and forged/public Spell reroll choices before restoration. Only the owner receives payment options; public state exposes resulting Sanity, not the ledger. Applicable unsupported Trish, Leo, Lola and Silas effects still stop casting rather than being ignored. Kerosene and Pallid Mask are allowed only as verified irrelevant possessions for this Action test; Spell-affecting Artifacts remain guarded.

A separate private snapshot capability marker survives completed casting, so a fresh destination also rejects a missing usage ledger rather than treating it as legacy state. Genuine legacy states lack both new fields and can initialize them on their first accepted Norman cast. The conservative non-Azathoth awakening guard accounts for both the possible Sanity payment and reverse loss before rolling: at Doom 1, unused substitution and 3 Sanity reject without payment, dice consumption or an unresolved cast.

Engine regressions cover both physical copies, final die faces and success thresholds, both payment orders, resource boundaries, reverse defeat and RNG rollback. Two-client room tests cover ownership, stale/replayed input, snapshot validation, reconnect and room isolation. The isolated browser fixture covers Norman with zero Clues, reload before payment, one Sanity spent and no repeated payment after reload. Production setup now grants Norman's Feed the Mind as described below; other Clue-payment contexts, Norman's action, Spell rewards/trading and full-family execution remain pending. See the approved Norman specification and execution ledger under `docs/superpowers/` for verification results.

## Norman's starting Spell (2026-10-21)

An explicit, validated `startingSpellIds: ["spell_feed_the_mind"]` on Norman links his printed starting equipment to executable setup. Ordinary START_GAME initializes the private 20-copy inventory, then uses the existing bottom-first named search and shuffle to grant one physical copy. No fixed reverse is selected. Legal REPLACE_INVESTIGATOR uses the same internal helper and available supply only. A missing available copy permits replacement without a grant; corrupt or missing required content rejects. Cards on living colleagues or defeated sheets are never taken.

The external command owns the single version increment. Errors roll back retained deterministic queues across the entire command, and rejected state is never published. Production replacement uses server crypto shuffle of the actual supply size, also retaining Clue-discard recycling support. Starting gain does not spend a component action or reset round usage on replacement. Public state/events expose only the front, while copy identity/order/reverses remain private. Old active snapshots and reconnects do not receive retroactive grants.

The production Playwright journey now covers ordinary lobby → Norman's starting card → cast → reload at the owner decision → a legal completion independent of the initial roll/reverse. Two-client room cases and deterministic engine tests cover both copies, depleted supply, replacement, validation, rollback, ownership and privacy. Existing seeded browser tests remain separate, testing particular casting outcomes rather than startup acquisition. Other investigators' starting Spells and full-family execution remain unsupported; readiness stays `needs_review`. Earlier dated sections describe their historical scope. Final results are in `docs/superpowers/plans/2026-10-21-norman-starting-spell.md`.
