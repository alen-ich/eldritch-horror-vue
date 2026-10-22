# Research recycle array ownership

## Intent and evidence

The next prerequisite before extending executable encounter content is preserving canonical state ownership across injected random providers. No npm dependency is needed. Research discard/recycling already exists; older status notes calling it missing are stale. `research-state.ts` validates shuffle output but returns the provider's array directly. Both removal and singleton completion install it in private state. Location's equivalent helper already copies its validated result.

## Scope and architecture

After successful Research recycling the engine owns an independent array of the validated card IDs. Mutation through a retained provider output cannot alter the returned state; mutation of the returned state cannot alter provider output. Cover last-card removal with prior discards and singleton completion. Preserve exact order, inventory validation, errors, RNG transaction behavior and caller input immutability.

Recommend copying the validated output in the existing private `shuffleCards` helper. Freezing the provider result would mutate a dependency-owned object and interfere with valid providers. Cloning all engine contexts/states would enlarge the boundary and cost without fixing ownership at its source.

## Authority and privacy

Pure TypeScript engine only; no network/framework imports, new command, public field or client decision. Private undrawn order remains server-side. This is an injected-provider ownership defect, not evidence of a client exploit. No rules or card readiness promotion.

## Acceptance and tests

Two integration-level engine regressions use real Research resolution/decision entry points with a valid provider that retains its returned array. Each proves the expected order, distinct identity, mutation isolation in both directions, and unchanged original input. Existing invalid shuffle, rollback, full eight-card lifecycle, JSON continuation and public projection tests remain green. Run root lint/typecheck/test/build, server multiplayer tests (included in root test) and all configured Playwright journeys. Review only this iteration's diff with one independent clean-context reviewer.

## Exclusions and approval

Other encounter/setup helpers, new game effects, persistence and global RNG redesign are separate iterations. Preserve every pre-existing dirty/untracked file. The source file selected here is clean at entry. User explicitly authorized self-approval and current-directory/current-branch execution. Self-review: no placeholders, contradictions or missing acceptance criteria; approved for planning.
