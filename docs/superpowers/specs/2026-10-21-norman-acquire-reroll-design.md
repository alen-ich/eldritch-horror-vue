# Norman: Acquire Assets Sanity reroll

## Intent and evidence

Deliver the next bounded dependency of Norman's shared Clue-payment ability: an authoritative Sanity-paid reroll during Acquire Assets. The existing uncommitted Norman action work is the baseline and must be preserved. `createTestRerollDecision` and payment currently call Spell-only helpers; Acquire Assets therefore omits a legal option even with zero Clues. Starting Spell inventory, casting and Norman's action already exist; older documentation is historical, not evidence of missing code.

No additional package is necessary. Installed baseline: pnpm 10.28.0, Colyseus 0.18.5, schema 5.0.32, Nuxt 4.5.2, Vue 3.5.42, Playwright 1.63.0. Engine stays pure TypeScript.

## Rules and alternatives

Recommended: extend the shared test-option/payment dispatcher to exactly `acquire_assets`, retaining the existing Spell-specific helper and private round ledger. One Sanity substitutes for one Clue once per round across all three supported contexts; the last Sanity cannot be spent. It rerolls one selected die and recalculates purchase strength using existing Asset rules. No Clue token moves. Keeping current dice is always possible.

The official Reference Guide (printed pages 2, 3, 11, 13) defines Acquire Assets, rerolls, spending, and explicitly permits Norman's ability for rerolls: https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/EH01%20Reference%20Guide.pdf . Retrieved 2026-10-21. Norman sheet evidence/hash is recorded in `docs/rules/base-game-investigators.md`; its URL was unavailable on this run, so this is not a fresh sheet verification.

Alternative 1: enable every test continuation at once. Rejected: combat, encounter and damage continuations require separate applicability and interruption audits. Alternative 2: add another Spell or unlock random Spell rewards. Rejected for this slice: random rewards can draw nine unsupported kinds and require their effects before broad readiness. This slice closes a concrete rule gap on the already playable Norman path, without claiming it is the sole global critical path.

## Architecture and authority

Add `canUseNormanTestReroll(state, playerId)` and `spendNormanTestReroll(state, playerId)` in the existing ability module. Spell eligibility delegates unchanged; Acquire eligibility requires active Action-phase owner, Influence test and available shared payment. Generate owner-only `norman-sanity:<die index>` options through the existing generic dialog. Validate current eligibility again when resolving. Retain strict RESOLVE_DECISION validation, room-derived actor, stale-version rejection and one version increment.

Initialize the capability marker/ledger on accepted Norman acquisition, including legacy states. Validate marked acquisition reroll snapshots against canonical regenerated options before room mutation or command execution. Genuine pre-feature acquisition snapshots without marker/options remain legacy-compatible; malformed marked snapshots fail closed. Use a deterministic-input checkpoint around Norman acquisition and its resumed test decisions so failed randomness never consumes retained queues.

Trish's same-space two-die Clue interaction remains unsupported. Reject before initial dice, or before resumed payment if she becomes applicable, while the new Sanity payment is available. Do not broaden unrelated legacy Acquire Assets guards. Payment is spending, not damage: prevention, defeat and awakening are not invoked.

## Privacy and exclusions

Reuse existing private usage and pending decisions. Observers receive resulting Sanity/dice and public decision summary, never options, usage ledger, physical Clue identities, Spell reverse identities or deck order. No new wire command, schema field, client rule calculation or optimistic mutation. No new dependencies, full Norman ability claim, other test contexts, Trish implementation, persistence, refactor or readiness promotion. No commits, push, merge, deploy or worktree.

## Acceptance and tests

Engine: zero-Clue acquisition offers payment; 2→1 Sanity; no final-Sanity payment; selected die and purchase successes; decline; physical Clues unchanged; already-used/other investigator/wrong continuation/owner/phase rejected; action and Spell usage in both directions; round reset inherited and covered by existing tests; immutable rejection, deterministic queue rollback, Trish initial/resumed guard; legacy initialization and invalid snapshot rejection.

Room: two real clients, owner-only options, unauthorized/stale/replayed selection, public Sanity synchronization, snapshot restoration and missing-ledger rejection. Browser: ordinary production lobby starts Norman, Acquire Assets exposes Sanity choice with zero Clues, reload restores choice, keyboard activation spends once, completion/reload cannot offer it again. Existing Norman action and Spell browser regressions also run.

Run root lint/typecheck/test/build, targeted multiplayer and Playwright. Record actual exits and limitations. One independent clean-context final reviewer; reproduce significant findings with failing tests before fixes.

## Self-review and approval

Checked scope, rules provenance, authority, privacy, legacy compatibility and testability. No unresolved placeholders. Self-approved under the user's explicit delegation; proceed to writing-plans.

## Verification-discovered prerequisite

Final Spell browser regressions exposed an existing ordering race in `useGameRoom`: a private owner choice arriving before an older public schema patch is overwritten by the patch and never restored. Reliable ownership-choice delivery is also required for this acquisition slice. Add a bounded client-only inbox keyed by decision ID, reconcile each public summary with its matching private message, clear on attaching another room, and never borrow options for a different ID. Display options only alongside their matching public snapshot/version, so a fast choice cannot submit the prior version. No client rule outcome, wire field or server-hidden state is added. Cover private-first/public-first/older-absent-patch and room reset in pure tests using the existing server Mocha runner (web has no unit runner), then rerun both browser suites. This narrow prerequisite is self-approved; broader transport refactoring is excluded.
