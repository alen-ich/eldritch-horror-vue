# Base-game Clue tokens

The user-supplied `source-assets/clues/Images (2).rar` contains 36 individual 512×512 scans. Each scan shows its location-bearing face above the shared magnifying-glass back. A visual contact-sheet audit verified exactly one face for every board location: the 21 numbered spaces and 15 named locations. The archive SHA-256 is `e8c4a62aac0fbab33aa2f3393ab4b32ab033bcad7e780a7177b49407b9a895fc`.

`packages/content/src/clues.ts` owns the 36 physical token IDs and their board locations. `pnpm clues:generate` reproduces the cropped WebP faces and shared back under `apps/web/public/tokens/clues`; it refuses a changed archive until the mapping is rechecked. Setup now shuffles those physical IDs into a server-private pool and reserves investigators' starting Clue tokens from it, so no extra copies are created. The discard/recycle lifecycle and Mythos placement transition are separate engine work. Undrawn and investigator-held token identities remain server-private.
