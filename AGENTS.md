# Codex Repository Instructions

This repository is an authoritative multiplayer web implementation of Eldritch Horror.

Before non-trivial changes:

1. Read `CODEX.md` for architecture, boundaries, testing, and working conventions.
2. Read relevant files under `docs/` for the subsystem being changed.
3. Inspect installed dependency versions before using framework-specific APIs, especially Colyseus.

Core invariants:

- Server owns canonical game state.
- Clients send commands/intents; they do not decide authoritative rule outcomes.
- `packages/engine` stays pure TypeScript and framework/network/database independent.
- Hidden information stays server-side.
- New rules and multiplayer behavior require tests.
- Runtime-validate network input.
- Do not overwrite unrelated user changes or commit secrets.

Before completion, run the relevant repository checks (target baseline: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) and report anything that could not be run.
