# First executable Spell: Feed the Mind

Date: 2026-10-20  
Status: Approved by the user on 2026-10-20 ("приступай"). Implementation plan requires separate approval; implementation is not yet authorized.

## Goal and interpretation

“Next dependency” means the next necessary rules capability, rather than a new npm package, consistent with the preceding Spell foundation and reverse-catalog work. Implement a complete, narrowly supported Feed the Mind casting lifecycle, covering both physical copies. This provides the first exercised bridge from private Spell inventory through authoritative tests, front effects, reverse resolution, and return to the front.

The present deliverable is this specification only. After approval, write a separate implementation plan; after its approval, implement natively in the current checkout and branch. Maintain an execution ledger, use TDD and systematic debugging, obtain one fresh final reviewer, reproduce important findings with failing tests, and verify fixes. No commits, pushes, merges, deployment, or worktree creation.

## Repository evidence

- Read root AGENTS.md and CODEX.md, architecture/interface notes, the base-game implementation roadmap, Reference Guide and FAQ notes, Spell rules, relevant encounter/Artifact notes, and existing Spell specs and execution records.
- Branch is `master`. Extensive existing tracked and untracked changes implement physical Spells and their private descriptive reverse catalog. Preserve all of them. This task adds only this document before approval.
- `packages/engine/src/spells.ts` already conserves 20 physical copies across supply, player holdings, and defeated sheets, with internal gain/discard helpers. `packages/engine/src/index.ts` initializes and projects this state and guards unsupported Spell effects. Reimplementing inventory is unnecessary.
- `packages/content/src/spells.ts` records Lore -1, Action timing, front text, and verified reverse-text status for Feed the Mind. Effects remain `not_executable`. The claim in an older roadmap paragraph that Spell backs are untranscribed is stale; the newer progress entry and code supersede it.
- `apps/server/src/private-spell-backs.ts` contains verified records for all 20 copies, including both Feed the Mind reverses. It is descriptive data, not executable behavior. Physical-copy suffixes and printed card numbers are distinct concepts.
- Generic tests, Clue rerolls, pending owner decisions, resource loss/defeat, capped improvements, Lily's improvement ability, and Artifact component-action continuations already exist. There is no Spell cast command or executable Spell continuation. The read-only Spell tray and supply browser test confirm the UI boundary.
- Arcane Manuscripts has verified front text but no typed Spell-test bonus in `assets.ts`; this is a real prerequisite for casting with that Asset, not evidence that it has no applicable effect.
- Installed package-store versions inspected: Colyseus 0.18.5, schema 5.0.32, SDK 0.18.2, Nuxt 4.5.2, Vue 3.5.42, Zod 4.6.5, Vitest 3.2.7. Multiple compiler peer variants exist. Resolve consumer manifests again before implementation; no dependency installation or upgrade is proposed.
- Existing architecture matrices predate many implemented systems. Treat their boundaries and source references as guidance and verify absence against code.

## Recommendation and alternatives

**Recommended: Feed the Mind, with a small typed casting continuation.** Its front exercises a recipient-owned skill choice; both backs use existing improvement, loss, and discard primitives. It avoids remote damage-reaction windows, combat modifiers, movement, and encounter replacement. Include only the casting infrastructure this card actually requires.

**Alternative: start with Flesh Ward or Instill Bravery.** These unlock useful protection, but require resumable damage windows, remote owners, prevention/replacement ordering, and interaction with defeat across many callers. Their dependency surface is larger.

**Alternative: enable Spell-reward Other World cards first.** Physical gain already exists, but random rewards can introduce any unsupported Spell. Acquisition alone would produce guarded play rather than a complete effect. Keep those cards disabled until post-gain applicability is supported.

## Scope and exclusions

Include both copies of Feed the Mind; cast intent validation; authoritative Lore tests and applicable supported modifiers; owner-only rerolls; recipient selection and skill improvements; both reverse handlers; loss/prevention and defeat integration; private continuation/restoration; component use accounting; front-only UI controls; and focused multiplayer/browser tests.

No other Spell becomes executable. Exclude general reaction windows, Spell trading, starting grants, reward encounters, a universal effect DSL, broader setup completion, accounts, persistence, and unrelated refactoring. In particular, Norman's starting Feed the Mind and his separate resource-substitution ability are not enabled by this slice. If an applicable unsupported investigator or possession effect would change this cast, reject before consuming dice or actions, as existing guarded slices do.

This slice intentionally has no new production acquisition route. Existing internal conserved gain operations supply engine and room fixtures. A browser fixture must seed holdings through an isolated test server or existing test harness, never a production grant command or client-selected draw. The result is an executable held-card capability, not a claim that ordinary setup now supplies it.

## Rules and sources

Authority: verified front/back records and existing crops, then the [official Reference Guide](https://images-cdn.fantasyflightgames.com/ffg_content/eldritch-horror/EH01%20Reference%20Guide.pdf), especially printed pages 3, 5–7, 11–13; confirmed official errata supersedes corrected text. Community compilation commentary alone is insufficient authority. Recheck the relevant crops when implementing handlers. Do not parse descriptive text at runtime.

The caster must be the active, living investigator in the Action phase, hold the card, have an action remaining, and satisfy existing delayed/detained, terminal-state, and pending-resolution restrictions. Monsters alone do not forbid this component action. Track use by the private physical component for the round, independent of ownership or discard/reacquisition; reset only at the existing round boundary.

Cast with Lore -1 using the normal test lifecycle. Apply improvements, minimum dice, Blessed/Cursed thresholds, applicable bonuses, and supported free/Clue rerolls. Add the scoped Arcane Manuscripts Spell Lore bonus and highest-bonus handling without making it a generic Lore bonus elsewhere. Reuse supported Urban Guide, Lucky Rabbit's Foot, and Cigarette Case semantics where applicable. Unsupported applicable effects reject atomically before the initial roll; unrelated possessions must not cause a blanket rejection.

Finalize rerolls before choosing the result branch. Preserve final individual die faces as well as success count: one reverse depends on whether any final die is a four. Do not reveal the physical reverse while rolling or selecting rerolls.

On a pass, the caster chooses one living investigator on the caster's space, including self; that recipient chooses one skill to improve. Use existing +2 caps and Lily's optional doubled improvement for each applicable improvement. A capped choice is legal and remains capped. On failure, skip the front improvement. Then resolve the actual held reverse on both success and failure; complete its instructions and return the retained card to its front.

Both physical reverses must be executable, including all thresholds, mandatory effects, optional additional improvement, conditional discard, and loss outcomes. Use the existing private catalog as the copy-to-outcome authority; do not reproduce that hidden mapping in shared content or this public design. Optional improvement belongs to the selected recipient and may choose the same or another skill. An optional loss-versus-discard instruction belongs to the caster; loss is not a spend cost and can cause defeat. Mandatory loss likewise uses ordinary damage semantics. The existing protection guards remain effective; unavailable reaction support must never be silently bypassed.

Charge one action and record component use exactly once per accepted casting lifecycle, including failed tests and discarded cards. Reserve the action while decisions remain pending and block unrelated commands. Existing defeat/terminal handling takes precedence over continuing a dead caster's resolution. Do not grant rewards twice, resurrect discarded cards, or charge a second action when reconnecting or finishing defeat choices.

## Architecture and privacy

**Protocol:** a strict cast intent identifies the public Feed the Mind front kind only. The server derives the actor and private physical source. Decisions use bounded server-generated IDs and the existing versioned envelope; clients supply neither dice, success count, reverse identity, effect instructions, nor authoritative resources. Exact interfaces/files belong in the approved plan.

**Engine:** a focused Spell casting module owns a serializable, discriminated continuation: source/caster, round, test, front recipient/improvement, reverse resolution, and completion. Keep all random inputs explicit and helpers version-neutral. Each accepted external command increments state version once; rejected commands preserve state, inventory, randomness consumption, events, and action availability. Persist recipient ownership separately from caster ownership so another player can answer only their own improvement choices.

**Private rules input:** server-local handwritten typed handlers translate the two verified reverses into the small operations required here. Supply validated private rule data to the pure engine through an engine-owned interface. Never import server modules, filesystem APIs, or the entire private catalog into the engine. Keep handlers separate from the descriptive catalog; no free-text interpretation or universal interpreter.

**Server:** retain pending source, reverse branch, and physical usage in canonical private snapshots. Clone and validate snapshots before restoration. Restore decisions to their actual owner; offline owners wait and may reconnect rather than being answered by the caster. Pending source identity, phase, owner, and component conservation are rechecked on resume. Preserve room isolation and reject stale, duplicate, or out-of-turn input.

**Visibility:** shared schemas and bundles contain front metadata and public consequences only. No private physical IDs, copy-to-outcome tables, reverse asset URLs, catalog text, or unselected branches enter public state. At the authorized flip step, send the caster only a purpose-built selected-resolution message if needed for the UI; it contains no physical ID or whole reverse table. Recipient choices contain only their authorized improvement options. Restore authorized transient views on reconnect and remove them at completion. Public events may report resulting resource/skill/inventory changes without recording hidden branch text. Existing privacy scanners need separate assertions for public traffic and narrowly authorized private messages.

**Web:** enable casting only for supported held fronts, display server-owned tests and caster/recipient choices, and show completion. Keep unsupported cards labelled accurately. Keyboard focus and reconnect must restore the correct decision. Availability hints never replace server validation.

Readiness stays `needs_review` for the family. Introduce accurate per-kind support metadata without converting all Spell effects to executable. All existing unsupported encounter/protection guards remain except the precise capability this spec implements.

## Acceptance criteria and tests

1. Either physical copy can complete its entire printed lifecycle. Deterministic tests cover failure, one/two/three-plus successes as applicable, final four present/absent, reverse discard, ordinary loss, optional improvement accept/decline, capped skills, and all source-specific thresholds.
2. Self and colleague recipients work; only the recipient chooses skills. Test Lily on either improvement, repeated skill selection, caps, no eligible remote/defeated targets, and illegal option rejection without mutation.
3. Tests verify Lore -1, one-die minimum, Arcane Manuscripts scope/bonus selection, supported auras/free rerolls, physical Clue conservation, altered success thresholds, rerolls that change a four or branch, and supported/unsupported investigator applicability.
4. Wrong phase, wrong owner, no card/actions, used component, delayed/detained state, stale version, malformed network input, invalid continuation, and unsupported reactions reject without partial mutation. Failed casts still consume one action. Test discarded/reacquired component usage and next-round reset.
5. Loss-to-defeat and terminal interruption preserve private inventory and existing defeat caches, clear obsolete choices, and never double-charge or resume completed effects. Fixed-context serialization round trips at every decision produce the same final state/events as uninterrupted play.
6. Two-client room tests cover casting, cross-player choice authorization, waiting while disconnected, reconnect to the same seat, stale/duplicate commands, and room isolation. Inspect actual public schema, events, targeted messages, and restored payloads for private-data leakage.
7. One focused two-browser test uses conserved seeded holdings, casts through the Spell tray, answers a recipient choice, reloads during a pending choice, and confirms synchronized results and completion. Keep the existing read-only supply test for unsupported/unheld cards. The seeded fixture must be inaccessible in the production server.
8. Public import-graph and built-artifact privacy regressions continue to pass. Add explicit coverage for typed private handlers and authorized selected-resolution messages rather than broadly weakening the existing scanner.
9. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, real server multiplayer tests, the focused Playwright case and existing browser suite. Run browser checks sequentially after build/typecheck to avoid generated-file churn. Record actual commands, results, limitations, and justified deviations in the implementation ledger.
10. Update Spell rules, the implementation roadmap, and owner-facing status after implementation. Clearly distinguish this one executable kind from unsupported starting grants, other Spells, and Other World 1/6/20. Preserve unrelated changes; review the final diff.

## Specification self-review

Checked scope, ambiguity, architecture consistency, privacy, and testability. Clarified that this slice has no production acquisition route; included Arcane Manuscripts instead of silently ignoring an applicable bonus; separated recipient and caster authorization; preserved final dice for conditional reverse behavior; and kept descriptive reverse data out of the engine/public import graph. This is one independently testable capability, with exact interface/task decomposition deferred to the plan. No placeholders or implementation steps are authorized by this document.

Inspection limitation: the `pnpm list -r --depth 0` launcher attempted to resolve pinned pnpm 10.28.0 and failed on registry DNS. Package versions above come from installed package-store entries and manifests, not a successful pnpm inventory. Verification results from earlier execution records are historical, not evidence that checks passed in this specification session.

Specification-stage verification: `git diff --check` passed for existing tracked changes (line-ending warnings only); the new document was separately inspected for incomplete sections and contradictions. `pnpm lint` failed before task execution with the same pinned-package-manager registry DNS error. Typecheck, tests, build, multiplayer, and Playwright were not run at this documentation-only approval gate; all remain required during approved implementation. No dependency files or product code were changed.
