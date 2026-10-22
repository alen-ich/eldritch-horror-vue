# Mystery/Asset setup ownership

2026-10-23: START_GAME copies the selected content-owned Mystery catalog before shuffle, and copies Mystery/Asset provider output before shift/splice. An identity provider no longer lets one game's start remove a Mystery from the shared catalog and prevent another lobby from starting. Retained provider permutations remain unconsumed and cannot mutate canonical remaining order afterward. Frozen or in-place permutations remain supported.

No public API, exception/transaction policy, printed rule, readiness or dependency changes. Active Mystery and Reserve stay public; remaining order stays private. Asset shuffle input was already a fresh filtered array; only its result needs copying. No universal malformed-permutation or arbitrary provider-side-effect guarantee is introduced.

TDD: RED 9 failures/1 valid in-place Asset control; GREEN 10/10 new and 94/94 combined setup/starting-Spell tests. Both starting-grant and non-grant games preserve content/provider arrays; tests cover literal order, two independent starts, state/content immutability, version and private projection filtering. Full checks and review: `docs/superpowers/plans/2026-10-23-mystery-asset-setup-ownership.md`.

index.ts already contained unrelated dirty work. The committed `docs/superpowers/patches/2026-10-23-mystery-asset-setup-ownership.patch` saves exactly this iteration's two changed expressions, already applied in this working directory. Do not apply twice. Full prior index.ts remains outside the commit; this patch depends on that foundation and is not a standalone clean-checkout implementation.

Next candidate checked against code: Cthulhu Research cards 1 Wilderness/7 City still reference monster_cultist in transcribed content while the engine encounter parser admits only Deep One/Star Spawn. Ancient One data currently provides Cultist toughness/effect IDs but not typed combat checks. Inspect the recorded source sheets before choosing a minimal rules slice; do not extend RNG hardening automatically now that this ownership dependency is resolved.
