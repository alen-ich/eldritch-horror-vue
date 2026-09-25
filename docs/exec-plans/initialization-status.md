# Initialization plan status

Source: `Eldritch_Horror_Web_Project_Initialization_Plan.docx`.

| Milestone | Status | Evidence |
| --- | --- | --- |
| 0. Tooling baseline | Complete | Root instructions, pnpm, and canonical root commands exist. |
| 1. Monorepo | Complete | Workspace packages and Turborepo task graph build together. |
| 2. Frontend boot | Complete | Nuxt app provides create/join UI and production build. |
| 3. Server boot | Complete | Colyseus 0.18 room starts and has headless integration tests. |
| 4. Two-player socket spike | Complete | Integration test connects two clients, synchronizes movement, and verifies room isolation. |
| 5. Protocol and identity | Complete for MVP | Zod command validation, server-derived actor identity, stable seat ID, and 30-second reconnect policy. |
| 6. Engine skeleton | Complete | Pure package with legal/illegal rule tests. |
| 7. First vertical slice | Complete | Create/join, select, start, move, sync, and reconnect implementation. |
| 8. Content pipeline | Not started | Next planned milestone. |
| 9. Core game loop | Not started | Depends on content and expanded rules. |
| 10. Persistence | Deferred | Intentionally follows the in-memory MVP. |
| 11. Production baseline | Not started | Docker/CI/observability remain future work. |

“Complete” here describes the initialization-plan gate, not a complete implementation of the Eldritch Horror board game.
