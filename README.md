# Eldritch Horror Web

An authoritative multiplayer prototype built with Nuxt 4, Colyseus 0.18, and a pure TypeScript rules engine.

## Understand and contribute

Start with the [project owner guide](docs/project-owner-guide.md): architecture, file ownership, a real command walkthrough, implemented coverage and limitations, debugging, and small exercises for making your own changes. Its code-inspected snapshot is dated 3 October 2026; older milestone documents may describe earlier slices.

## Run locally

Requirements: Node.js 22+ and pnpm 10.

```bash
pnpm install
pnpm dev
```

The server listens on `http://localhost:2567`. Nuxt prints its selected browser URL (normally `http://localhost:3000`). To use another server endpoint, set `NUXT_PUBLIC_COLYSEUS_URL` for the web process.

Open the web app in two browser windows. Create a game in the first, copy its invite link, and open that link in the second. Both players select different investigators from the 12-character base roster; the host can then start the game and move from each investigator's own starting location.

The game board uses a reproducible public-domain Earth basemap with interactive location inspection, legal-route highlights, movement animation, and bounded zoom controls. Run `pnpm map:generate` after changing the map-generation source.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The current implementation includes in-memory multiplayer setup, Actions, guarded combat/encounters/Research, partial Mythos, and defeat/replacement. The complete rules loop is not finished: possession effects, Reckoning, several encounter families, and live Mystery progress remain incomplete. Persistence and production deployment are deferred. See the owner guide for the current coverage and boundaries.
