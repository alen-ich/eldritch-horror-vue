# Physical Spell Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Track all 20 physical Spells deterministically across supply, investigators and defeated sheets while exposing only permitted fronts.

**Architecture:** Store the physical inventory entirely in `PrivateGameState.spells`. A focused pure engine module validates and transforms it; existing setup/lifecycle transitions compose those helpers and own canonical version increments. Public projection derives front-only holdings and supply top, which the room synchronizes and the existing inventory tray renders.

**Tech Stack:** TypeScript, Vitest 3, Colyseus 0.18 with Schema 5, Nuxt 4/Vue 3, Mocha, Playwright, pnpm 10.28.0. Inspect installed versions before implementation; add no dependencies.

**Spec:** [Approved design](../specs/2026-10-15-physical-spell-foundation-design.md).

## Global Constraints

- “Product implementation is outside the current request.” This plan requires user review before execution.
- “These are server/engine APIs, not new client commands.”
- “The outer transition advances the canonical version exactly once; helper composition must not increment it again.”
- “Do not put hidden fields inside the synchronized lifecycle JSON.”
- “Keep Spells `needs_review` / `not_executable`; successful inventory work is not whole-family readiness.”
- “No new scans or framework dependencies are required for this foundation.”
- Follow root `AGENTS.md`, `CODEX.md` and relevant rules notes; engine runtime imports remain framework-independent. Do not commit unless the user authorizes commits; suggested commit boundaries below are checkpoints, not authorization.

## Review Focus

1. Two physical copies sharing a front must produce identical public holdings and artwork (Tasks 1, 3, 5).
2. Random duplicate returns can repeatedly draw duplicates; exhausted injected input must reject atomically, while all-duplicate availability must terminate immediately (Task 2).
3. Defeat caches hidden inside the public lifecycle JSON could leak reverse identity even when ordinary player fields are safe (Tasks 3, 4).
4. Empty supply and missing inventory are different; restoration must never manufacture the missing 20 cards (Tasks 1, 4).
5. A colleague's protective Spell can affect damage to another investigator; guards must inspect relevant living holders, including off-space effects (Task 3).

## File structure and interfaces

- Create `packages/engine/src/spells.ts`: engine-only Spell catalog types, private inventory shape, conservation, initialization, gains/discard and timing guard. Import existing engine types with `import type`; do not import content.
- Modify `packages/engine/src/index.ts`: export Spell APIs, extend `PrivateGameState` and `GameContent`, derive public projection, integrate setup/defeat/replacement and guards. Avoid general refactoring of this large file.
- Modify `packages/protocol/src/index.ts`: public Spell front type, public fields and safe events only; leave the command schema unchanged.
- Modify `packages/content/src/spells.ts`: canonical public-front mapping; re-export through the existing content index.
- Modify `apps/server/src/rooms/GameRoom.ts` and `apps/server/src/rooms/schema/GameRoomState.ts`: catalog adapter, private round trip, derived public fields.
- Modify `apps/web/app/composables/useGameRoom.ts` and `apps/web/app/app.vue`; create `apps/web/app/components/SpellInventory.vue`: snapshot fields and read-only Spell presentation.
- Create focused engine/content/server tests and `tests/e2e/spell-inventory.spec.ts`; preserve existing suites.

Use the following names consistently:

```ts
// protocol: public kinds, never copy IDs
type SpellFrontId = `spell_${string}`;
// engine/spells.ts: no content runtime dependency
type SpellDefinition = {
  id: string; kind: string; trait: 'incantation' | 'ritual';
  timing: 'action' | 'encounter' | 'combat' | 'prevent_health_loss' | 'prevent_sanity_loss';
};
type PrivateSpellInventory = {
  deck: string[]; // top first, random draw from last
  heldByPlayer: Record<string, string[]>;
  heldByDefeatedInvestigator: Record<string, string[]>;
};
type SpellGainRequest = { type: 'random' }
  | { type: 'kind'; kind: string }
  | { type: 'trait'; trait: 'incantation' | 'ritual' };
```

Physical IDs remain ordinary internal strings validated against the exact catalog. `SpellFrontId` is a public compile-time alias, not sufficient runtime validation: only catalog-derived kinds are permitted. Add `GameContent.spells?: readonly SpellDefinition[]` and `PrivateGameState.spells?: PrivateSpellInventory`. Canonical players and defeated-sheet records do not store a second physical or front inventory. Public player/defeated-sheet types gain `spellIds: SpellFrontId[]`; public game state gains `spellSupplyTopId?: SpellFrontId`. Empty and lobby supply map to absent top.

## Task 1: Private inventory, conservation and safe front catalog

**Files:** Create `packages/engine/src/spells.ts`, `packages/engine/test/spell-inventory.test.ts`, `packages/content/test/spell-fronts.test.ts`; modify the engine/content/protocol files listed above.

**Interfaces:**
- `createSpellInventory(catalog: readonly SpellDefinition[], playerIds: readonly string[], context: EngineContext): PrivateSpellInventory`.
- `validateSpellInventory(state: GameState, catalog: readonly SpellDefinition[]): string | undefined` returns a safe validation reason, not hidden IDs. It validates the inventory; ordinary lobby state without inventory is not passed to it.
- Content export `baseGameSpellFronts: readonly { id: SpellFrontId; name: string; trait: 'incantation' | 'ritual'; frontImageUrl: string }[]` has exactly ten entries. Choose copy 01's existing front image for each kind regardless of held copy. Do not include physical IDs or reverse metadata in these records.

- [x] **1. Write failing tests:** `initializes all 20 physical copies once` asserts deck length 20, exact catalog multiset, injected reverse order and empty holdings per seat. `rejects corrupt conservation` covers unknown/duplicate/missing copies, unknown seat/cache keys and duplicate held kinds. `distinguishes empty supply from missing inventory` accounts for all copies elsewhere, then removes inventory and expects rejection. `front catalog is copy independent` asserts ten records, e.g. `spell_wither`, and identical rendering lookup for both physical Wither copies.
- [x] **2. Run red:** `pnpm --filter @eldritch/engine exec vitest run test/spell-inventory.test.ts` and `pnpm --filter @eldritch/content exec vitest run test/spell-fronts.test.ts`; expect missing API/export failures.
- [x] **3. Implement interfaces and types:** require the 20-ID catalog with ten kinds/two copies; validate full multiset, unique seats/investigators, cache references and one kind per holder. Permit absent empty holding lists only if all 20 copies remain accounted for. Reject malformed catalog rather than trusting ID regex alone. Initialization calls injected shuffle once; deep-copy inventory at every existing clone path, including private state and public projection boundaries.
- [x] **4. Run green:** rerun both commands; assert public front records contain no copy ID, back path or back text. Add projected-array isolation coverage in Task 3 where the projection is introduced.
- [x] **5. Review checkpoint:** inventory module and catalog contract only. Suggested commit: `feat(engine): model conserved private Spell inventory`.

## Task 2: Deterministic internal gain and discard

**Files:** Modify `packages/engine/src/spells.ts`, `packages/engine/src/index.ts`, `packages/protocol/src/index.ts`; create `packages/engine/test/spell-gain-discard.test.ts`.

**Interfaces:**
- `gainSpell(state: GameState, playerId: string, request: SpellGainRequest, content: GameContent, context: EngineContext): CommandResult`.
- `discardSpell(state: GameState, playerId: string, physicalId: string, content: GameContent, context: EngineContext): CommandResult`.
- Both return cloned state and leave its version unchanged. Add safe `SPELL_GAINED` / `SPELL_DISCARDED` events with `playerId` and `spellId: SpellFrontId`; a no-gain emits neither. Add engine errors `SPELL_CONTENT_MISSING`, `SPELL_INVENTORY_INVALID`, `SPELL_NOT_HELD`, `SPELL_EFFECT_UNSUPPORTED`, `SPELL_RANDOM_INPUT_INVALID` as needed, reusing existing membership/game-state errors.

- [x] **1. Write failing tests:** `random gain draws bottom` checks the exact private copy and unchanged remaining order; `duplicate random draw returns and reshuffles before retry` supplies deterministic shuffle queues and checks the actual final copy/order. `all available kinds already held grants nothing without RNG` uses a throwing RNG and expects success/no event. `named duplicate returns new copy` retains the old copy and verifies shuffle. `trait gain searches bottom and excludes held kinds` pins first eligible copy and post-search shuffle. `missing match and depleted supply grant nothing` preserves conservation and distinguishes malformed inventory. `discard returns exact owned copy` checks complete shuffled multiset. Test invalid player, lobby, terminal, defeated/eliminated recipient, invalid filter, colleague-owned discard and malformed inventory before RNG; original state stays equal, errors omit physical identities. `input exhaustion after duplicate rejects whole operation` checks no published partial result. Source comments cite Reference Guide pp. 5–6 and 11.
- [x] **2. Run red:** `pnpm --filter @eldritch/engine exec vitest run test/spell-gain-discard.test.ts`; expect missing operation failures.
- [x] **3. Implement operations:** clone before changes; validate before RNG. Detect no eligible unowned kind before random retry, but otherwise perform real bottom draws and duplicate discard/shuffles, with no filtering or arbitrary retry cap. Catch exhausted/invalid context input as a safe failed result. Named/trait searches shuffle even on a completed unsuccessful search; a genuinely empty deck needs no random input. Named duplicates shuffle only once for the combined search/return result, which implements the required final randomization. No-op operations keep version unchanged. No new network command or starting grant.
- [x] **4. Run green:** rerun Task 2 plus Task 1 engine tests. Prove repeated identical inputs give identical events/state and public events expose only fronts.
- [x] **5. Review checkpoint:** suggested commit `feat(engine): add deterministic internal Spell gains and discard`.

## Task 3: Setup, public projection, defeat and unsupported-effect boundaries

**Files:** Modify `packages/engine/src/index.ts`, `packages/engine/src/spells.ts`, `packages/protocol/src/index.ts`; create `packages/engine/test/spell-lifecycle.test.ts` and `packages/engine/test/spell-guards.test.ts`.

**Interfaces:** Task 1 private inventory and Task 2 operations. Add `spellEffectIsUnsupported(state: GameState, playerId: string, context: 'encounter' | 'combat' | 'health_loss' | 'sanity_loss', content: GameContent): boolean`. The function validates relevant holdings and returns true when the context intersects an unimplemented effect. Missing metadata for a relevant held copy fails safely.

- [x] **1. Write failing lifecycle tests:** setup with full catalog produces 20 cards and empty holdings; append Spell initialization after existing setup RNG consumption so pre-existing outcomes remain identical. `projection hides both copies identically` compares copy 01/02 holdings, defeated caches and supply top, scans serialized projection and owner-specific projection for physical IDs, and mutates returned arrays without affecting input. `defeat caches exact copies once` then replacement keeps that cache and starts empty. A repeated rejected defeat changes neither inventory nor version. `outer success increments once` checks START_GAME and RESOLVE_DEFEAT; internal helper calls stay version-neutral. Preserve no-Spell minimal engine fixtures when `content.spells` is absent, without enabling Spell operations on them.
- [x] **2. Run red:** `pnpm --filter @eldritch/engine exec vitest run test/spell-lifecycle.test.ts test/spell-guards.test.ts`.
- [x] **3. Integrate lifecycle:** supply is initialized only in START_GAME, never on restoration. Cache key is the defeated investigator ID, not the seat reused by replacement. Public projection decorates cloned player and defeated records from private mappings; explicitly strip private inventory. Update public type overrides rather than claiming canonical/public players are identical. Derive supply top from index zero.
- [x] **4. Write and implement guard tests:** combat rejects held Wither; noncombat encounter rejects holder Clairvoyance/Mists; ordinary Health/Sanity damage rejects any living relevant Flesh Ward/Instill Bravery holder, including a remote colleague. Audit General/Research/Other World, combat/ambush, Mythos and Condition damage entry points and resumed decisions. Guard before RNG, card consumption or damage. Tests restore holdings between initial and resumed execution and expect rejection. Ritual-only holdings must still permit MOVE, PREPARE_TRAVEL, END_ACTIONS and unrelated ordinary tests. Spending Health/Sanity is not preventable loss. If precise applicability cannot be proven, return unsupported for the affected context rather than ignore the Spell. Test known nonapplicable contexts remain legal.
- [x] **5. Run green:** targeted lifecycle/guard suites, then `pnpm --filter @eldritch/engine test`; ensure Other World 1/6/20 and existing possession guards remain unchanged. Review every damage/test invocation identified in the audit; record the coverage matrix in Spell rules notes.
- [x] **6. Review checkpoint:** suggested commit `feat(engine): preserve Spell privacy across setup and defeat`.

## Task 4: Real room synchronization and restoration

**Files:** Modify `apps/server/src/rooms/GameRoom.ts`, `apps/server/src/rooms/schema/GameRoomState.ts`; create `apps/server/test/SpellInventory.test.ts`.

**Interfaces:** Adapt `baseGameSpells` to `GameContent.spells` using only id/kind/trait/timing. Room schema adds player `spellIds` as a comma-separated string and root `spellSupplyTopId` as a string (empty means none), matching current schema conventions. `PrivateGameState.spells` remains in the existing private room field; no extra parallel room map.

- [x] **1. Write failing two-client tests:** boot the real app using the `GameRoom.test.ts` test-server pattern. Start a room, call `toEngineState()`/`applyEngineState()` through a test-only typed internal view, and inject conserved holdings with Task 2 helpers. Assert both clients get the same fronts/top, full private JSON restoration retains exact copies, and all client schemas/lifecycle JSON/messages omit physical IDs and reverse paths. Check another room remains unaffected. Reconnect the same seat and assert physical holdings unchanged; cover defeat/replacement cache privacy and missing inventory not being regenerated. Send invented gain/cast/discard command envelopes and assert protocol rejection with no mutation.
- [x] **2. Run red:** `pnpm --filter server exec mocha -r tsx test/SpellInventory.test.ts --exit --timeout 15000`.
- [x] **3. Implement adapter/round trip:** apply public Spell fields only from engine projection; reconstruct canonical inventory solely from the private room field. Do not consume or trust client-visible `spellIds` to pick a copy. Clone private inventory at restoration boundaries so externally retained snapshots cannot mutate room truth. Fail safely on corrupt restoration, without replacing the last valid room state or revealing the corrupt ID.
- [x] **4. Run green:** targeted command, then `pnpm --filter server test`. Capture a client-observed snapshot after gain, discard, defeat and reconnect and inspect public versus private forms. Reuse installed Colyseus testing/reconnect APIs; verify versions before modifying calls.
- [x] **5. Review checkpoint:** suggested commit `feat(server): synchronize front-only Spell inventory`.

## Task 5: Read-only inventory and browser verification

**Files:** Create `apps/web/app/components/SpellInventory.vue` and `tests/e2e/spell-inventory.spec.ts`; modify `apps/web/app/app.vue`, `apps/web/app/composables/useGameRoom.ts`. Use the existing `playwright.config.ts` servers.

**Interfaces:** `SpellInventory` props: `spellIds: readonly SpellFrontId[]`, `supplyTopId?: SpellFrontId`. It consumes `baseGameSpellFronts`, never physical copy IDs. Composable exposes synchronized player fields and a reactive root supply top; app passes the current player's holdings into the existing Spells tray.

- [x] **1. Add failing browser test:** create/join/start using the existing journey pattern, select Spells, and expect “Effects not implemented,” empty holdings and a visible top front. Assert no cast/flip/discard/trade controls in the Spell panel, no physical-copy ID in DOM metadata, and the same supply top after reload/reconnect. Existing browser tests have no authoritative holdings-injection fixture; do not introduce a grant endpoint or broaden the server harness merely for this slice. The spec makes a browser holdings fixture conditional. Pin copy-independent held-front mapping in Task 1 and actual held synchronization/reconnect in Task 4; explicitly report that held-card DOM rendering has no dedicated browser case.
- [x] **2. Run red:** `pnpm exec playwright test tests/e2e/spell-inventory.spec.ts`; expect missing Spell view assertions to fail.
- [x] **3. Implement view and snapshots:** map public kinds to canonical front records, label supply top separately from holdings, and render absent supply as empty. Reuse tray layout and accessible image text; no new interaction or authority. The existing client setting is `NUXT_PUBLIC_COLYSEUS_URL` (default `http://localhost:2567`); leave it unchanged and use normal browser ports.
- [x] **4. Run green:** targeted Spell browser suite plus `pnpm test:e2e` for all three existing multiplayer regressions. Assert the production server never registers a fixture/grant route. Browser supply coverage and room holdings coverage must be reported separately; neither is unrestricted Spell gameplay coverage.
- [x] **5. Review checkpoint:** suggested commit `feat(web): show synchronized Spell fronts without casting controls`.

## Task 6: Rules notes, full verification and handoff

**Files:** Modify `docs/rules/base-game-spells.md`, `docs/exec-plans/base-game-rules-implementation.md`, `docs/project-owner-guide.md`; keep readiness/effect statuses unchanged.

**Interfaces:** No new production API. Documentation describes Tasks 1–5's exact implemented inventory-only surface and timing guard matrix.

- [x] **1. Update rules notes:** cite Reference Guide printed pp. 5–7/11 for draw/search/duplicate/discard/privacy; describe supply orientation, event/version ownership, private cache keys, legal top-front visibility and no-gain behavior. Explain starting Spells, trading, casting/reverses and Other World rewards remain pending.
- [x] **2. Verify source references and plan coverage:** confirm all eight acceptance criteria have tests in Tasks 1–5 and each Review Focus item has a corresponding assertion. Search public payload construction for physical inventory leakage; inspect setup RNG fixtures for unchanged pre-Spell results. Fix actual gaps, without enabling additional effects.
- [x] **3. Run root checks sequentially:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; then the affected Spell browser suite and `pnpm test:e2e`. Expect exit code 0 and all cases passing. The web package's `test` is currently typechecking; actual browser coverage comes from Playwright. If pnpm version resolution fails, report it as an environment failure and use the normal required network-approval path, never claim checks passed.
- [x] **4. Review diff:** `git diff --check`, `git diff --stat`, and scoped diff review. Ensure no reverse artwork moved into public assets, no new command, no unsupported encounter enabled, no dependency churn and no unrelated changes. Include any newly created files in review; an untracked file is absent from ordinary `git diff` output.
- [x] **5. Final handoff:** report implemented scope, exact verification outcomes and remaining limitations. Suggested final checkpoint `docs: record physical Spell foundation and remaining effect work`; commit only if separately authorized.

## Execution recommendation

Use native execution for these six sequential tasks: state shape, helpers, lifecycle and room projection share tightly coupled interfaces. Review the whole change with a fresh reviewer after tests, with particular attention to reverse identity leakage and duplicate retry semantics. Subagent-driven execution is available if the user prefers independent review after each task. The user selected native execution; implementation and the final fresh review are complete.

## Execution result — 2026-10-15
Implemented in the current master checkout by user choice, without commits. Root lint/typecheck/test/build pass; tests cover 1129 engine, 99 content, 19 protocol and 161 server cases, plus four Playwright journeys. Fresh review found three Important issues; all were reproduced RED and fixed GREEN: continuation actor scoping, mandatory active inventory and record-shaped ownership maps. No Critical or deferred Minor findings. Iteration used installed Node test runners where appropriate; root verification used pnpm. Server Spell cases share the existing test server. Legacy synthetic room fixtures explicitly seed lobby Spell inventory, and nine content tests use fileURLToPath for Windows. Casting, starting Spell grants and reward encounters remain deferred as specified.
