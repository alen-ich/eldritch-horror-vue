# Eldritch Horror Web

An authoritative multiplayer prototype built with Nuxt 4, Colyseus 0.18, and a pure TypeScript rules engine.

## Run locally

Requirements: Node.js 22+ and pnpm 10.

```bash
pnpm install
pnpm dev
```

The server listens on `http://localhost:2567`. Nuxt prints its selected browser URL (normally `http://localhost:3000`). To use another server endpoint, set `NUXT_PUBLIC_COLYSEUS_URL` for the web process.

Open the web app in two browser windows. Create a game in the first, copy its invite link, and open that link in the second. Both players select different investigators; the host can then start the game and move along the prototype map.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The current slice includes an in-memory lobby and action turn. Card content, the complete rules loop, persistence, and production deployment remain later milestones.
