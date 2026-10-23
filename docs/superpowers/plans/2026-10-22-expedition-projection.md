# Expedition discard projection isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL superpowers:executing-plans inline, TDD, independent final review.

**Goal:** Prevent public projection mutations from corrupting canonical Expedition inventory.
**Architecture:** Copy/default one array at shared projectStateForPlayer boundary.
**Tech Stack:** Existing pure TypeScript/Vitest3.2.7; no dependencies.
**Spec:** docs/superpowers/specs/2026-10-22-expedition-projection-design.md

## Global constraints
Current directory/branch; preserve unrelated changes. No commit/push/merge/deploy. Self approval explicitly delegated. No new rules, protocol, schema or readiness claims.

## Review focus
Public-to-canonical alias, canonical-to-public alias, owner projection path, missing legacy field, hidden active binding/deck privacy. Task1 covers all cases.

## Task 1: Two-way isolation RED to GREEN
Files: packages/engine/src/index.ts and packages/engine/test/expedition-discard.test.ts.
Interfaces: existing projectStateForPlayer(state,viewer?) and projectPublicState(state) return types unchanged; expeditionDiscardIds cloned/defaulted to[].
- [x] Add parameterized public/owner tests on valid physical discard state, mutate projected list and verify canonical unchanged, then mutate canonical and verify snapshot unchanged. Check legacy absent field defaults[] without adding source field; assert no deckOrderById/expeditionDraw in projection.
- [x] Run pnpm --filter @eldritch/engine exec vitest run test/expedition-discard.test.ts and observe alias failures.
- [x] Copy/default expeditionDiscardIds next to otherWorldDiscardIds in projectStateForPlayer; rerun focused/full engine tests.
- [x] Append actual scope to docs/architecture/other-world-integrity.md.

## Task 2: Final review and checks
- [x] One clean-context reviewer checks task diff against .superpowers/expedition-projection baseline copies. Material findings reproduced RED, fixed GREEN.
- [x] Run pnpm lint/typecheck/test/build and all three Playwright configs sequentially; socket tests use expanded permissions and bundled pnpm PATH. Record results/limits and review scoped diff/git diff --check.

## Self-review and ledger
Spec requirements mapped to exact shared boundary and tests; no interface changes or ambiguous migration. Plan self-approved. Ruling: fix only the verified Expedition array alias, leaving Location/Research physical discard to a later iteration; cost is those already documented rule gaps remain.
- Task1 RED3 failures: public and owner mutation corrupted canonical array; legacy absent projection returned undefined. GREEN focused49/49 across Expedition setup/discard and Other World discard. One copied/defaulted array at shared projection boundary; no rule/protocol changes.
- Independent clean-context review: no actionable findings; reviewer independently ran Expedition discard21/21. Root lint/typecheck/test exit0, including server290 and engine1353 (content127/protocol21). Final build exit0; sequential browser runs pending. No changed rules or external dependencies.
- Final verification complete: pnpm lint/typecheck/test/build exit0; engine1353/content127/protocol21/server290. Sequential Playwright default7/7, Norman2/2, Spell2/2, all exit0. Only existing Turbo output-cache and runtime warning notices. No deferred reviewer findings. Scoped diff and git diff --check clean apart from pre-existing LF/CRLF notices. No new dependencies; unrelated work preserved; no Git mutation.
- Next iteration discovery: inspected the shared completion at packages/engine/src/index.ts, which still bottom-cycles Location/Research cards. Those families need their own conserved physical zones and catalog-aware legacy migration before readiness; Other World and Expedition now have independent physical inventories and isolated public discard arrays. No unrelated rules or guessed card effects were introduced.
