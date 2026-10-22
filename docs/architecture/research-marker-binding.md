# Research original marker provenance

2026-10-22: new Research draws persist private pendingLocationEncounter.researchMarkerBinding with the selected markerId and physical clueId. The shared continuation validator checks all remaining marker effects, including unchosen tests/optional/ambush branches and runtime checkpoints, against this saved target. A live marker must still hold exactly that token. Neither investigator nor marker location is frozen. A collected/absent marker is accepted only if no marker references remain.

Server restoration preserves an existing binding when restoring the same active card; stripping or changing its marker/token rejects before mutation. Metadata stays private with the continuation; no new public field, wire command, client rule, package or printed effect changed. Generic errors omit marker/token identities.

Legacy snapshots without binding retain prior validation, without guessed migration. A fresh room cannot authenticate a wholly self-consistent fabricated snapshot: this checks consistency, not signatures. The same-active-room guard prevents downgrading an existing bound continuation. Full legacy provenance cannot be reconstructed after references have been consumed; no such guarantee is claimed.

Tests cover actual draw/JSON resume/private projection, redirected nested effect, token replacement, malformed binding, foreign-family misuse, moved and consumed marker and old unbound snapshots. Real two-peer test verifies valid restore, stripping/replacement refusal and private wire boundary. Root checks passed; final browser/review evidence is recorded in docs/superpowers/plans/2026-10-22-research-marker-binding.md.

index.ts, GameRoom.ts and GameRoom.test.ts already contained unrelated changes. Exact already-applied deltas are saved in docs/superpowers/patches/2026-10-22-research-marker-binding-working-tree.patch; do not apply twice. Reverse verification uses --unidiff-zero. This save requires the current working-tree foundation and is not a standalone clean checkout. New/clean files are committed normally.

Final verification: pnpm lint/typecheck/build5/5 tasks each exit0; pnpm test8/8 with1513 engine,127 content,21 protocol,304 server tests. Serial Playwright main7/7, Norman2/2 and Spell2/2 passed. Independent clean-context review found no material issue and passed10/10; minor explicit draw→collect→pause→JSON journey coverage is deferred, with synthetic consumed-marker compatibility and existing Research integration suites passing.
