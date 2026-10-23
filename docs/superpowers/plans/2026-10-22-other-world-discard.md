# Physical Other World discard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline. TDD for every behavior; one independent clean-context reviewer at the end.

**Goal:** Replace Other World bottom cycling with conserved physical draw/discard/recycle.
**Architecture:** Extend existing shared inventory validator, private pending binding and existing public projection. Reuse atomic random boundary from previous iteration. Server remains authoritative; engine stays pure.
**Tech Stack:** Installed Colyseus0.18.5/SDK0.18.2, Nuxt4.5.2/Vue3.5.42, Vitest3.2.7, Playwright1.63.0; no new packages.
**Spec:** docs/superpowers/specs/2026-10-22-other-world-discard-design.md

## Global constraints
Current directory/branch. Preserve every pre-existing change; baseline copies in .superpowers/other-world-discard. No commit/push/merge/deploy. User delegates spec/plan approval. Scope only Other World, no new executable effects or readiness claim.

## Review focus
Legacy top-bound migration occurs once; invalid flags/sparse zones reject; final draw recycles only prior discards; malformed shuffle rolls back; lethal effects still discard once. Two peers never see private order/flag and room replacement clears public discards. Tasks below cover these cases.

## Task 1: Inventory and lifecycle
Files: packages/engine/src/other-world-state.ts, packages/engine/src/index.ts, new packages/engine/test/other-world-discard.test.ts, existing packages/engine/test/other-world-encounter.test.ts.
Interfaces: GameState.otherWorldDiscardIds?: string[]; pendingLocationEncounter.cardRemovedFromDeck?: true. Keep validateOtherWorldState(state,content): string|undefined. Internal removeOtherWorldEncounterCard(state,content,context): string|undefined mutates only caller clone; shift legacy top once, flag true, immediately replenish empty undrawn zone from prior discards, validate conservation and shuffle output.
- [x] RED add tests for removed in-flight top, faceup finish, last-card recycle exclusion, singleton replenishment, legacy continuation, strict flag and malformed discard/unknown/duplicate/sparse zones. Failed shuffle restores RNG and original state.
- [x] Run pnpm --filter @eldritch/engine exec vitest run test/other-world-discard.test.ts, confirm failure.
- [x] GREEN extend validator for full legacy inventory versus deck/discard/active partition. Remove redundant top/full-deck checks in otherWorldBindingIsValid because shared validator owns identity conservation. In continueLocationEncounter migrate cloned pending after preflight, then discard at finish (including defeat) with immediate singleton refill; preserve Location/Research bottom cycling. Setup initializes [], public projection copies [].
- [x] Update old bottom-cycle expectations to discard zones. Tests that corrupt a pending removed top must instead corrupt its binding/conservation; legal remaining order changes are no longer invalid binding. Run focused suites and full engine/typecheck.

## Task 2: Public synchronization and restoration
Files: apps/server/src/rooms/schema/GameRoomState.ts, apps/server/src/rooms/GameRoom.ts, apps/web/app/composables/useGameRoom.ts, apps/server/test/OtherWorldState.test.ts, apps/server/test/GameRoom.test.ts, apps/server/test/RoomSnapshotIsolation.test.ts.
Interfaces: Schema.otherWorldDiscardIds JSON string default []; room serializes/parses this list; composable readonly string[] default[]. Existing restore validator rejects malformed zones before mutation. Existing public engine projection includes the list only.
- [x] RED real two-client room tests restore conserved deck/discard/active snapshots, reject malformed discards unchanged and synchronize faceup list without private order/binding. Composable test verifies list and replacement reset. Run focused Mocha, observe missing projection.
- [x] GREEN wire list using Expedition pattern; update old room bottom-cycle assertions to discard zones, run all server tests and client lifecycle tests.
- [x] Update docs/architecture/other-world-integrity.md to current lifecycle, private boundaries and remaining Location/Research limitation.

## Task 3: Review and checks
- [x] Clean-context independent reviewer, reproduce substantive findings RED, fix GREEN.
- [x] Run pnpm lint/typecheck/test/build; pnpm test:e2e; Playwright Norman and Spell configs sequentially. Use bundled pnpm PATH with dependency repair disabled; local sockets need expanded permissions. Record actual results and scoped diff review; no Git mutations.

## Self-review and execution journal
Existing specification reviewed against code: physical zones and legacy migration are fully specified; RNG prerequisite now exists. Spec self-approved; plan self-approved. Every review focus case has an owning test. No unresolved rules inferred. Ruling: keep Location/Research bottom cycling as a separate slice to limit migration scope; cost is those documented rule gaps remain.
- Task 1 RED11/11 failed on absent physical zones/migration; GREEN11/11. Existing encounter suite initially failed123 outdated cycle expectations; updated assertions to remaining deck/faceup discards and corruption of active identity rather than legal remaining-order permutation. Focused499/499; root engine1349/1349.
- Task 2 RED real room lost discard list, real composable lacked list; GREEN composable1/1 and typecheck exit0. Root server initially90 failures at obsolete full24-undrawn assertion; changed to23-undrawn plus conserved24 across zones. New real two-peer lifecycle assertions added.
- Independent review P2: public projection aliased the canonical Other World discard array. Reproduced RED by pushing an unknown ID into projected list (1 failure); fixed by copying/defaulting the list at projectStateForPlayer. No pending/deck leakage introduced. Focused suites rerun GREEN.
- Final review: one P2 alias finding reproduced and fixed; reviewer reported no additional actionable findings. Root lint/typecheck exit0; root test engine1350/content127/protocol21/server290, exit0. Default Playwright7/7 and Norman2/2 exit0. Build hit Windows EPERM creating generated .output/server/node_modules/vue-bundle-renderer; isolated rerun pending after browser dev processes finish. Spell browser pending.
- Final Spell2/2 and isolated expanded-permission build exit0. Build EPERM resolved without product/config changes. All required checks passed; scoped diff and git diff --check reviewed. No deferred review findings. No new package or Git history/index change. Subsequent iteration investigates the pre-existing Expedition discard projection alias exposed by the independent review.
