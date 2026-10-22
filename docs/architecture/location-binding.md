# Location continuation binding

Current status: the physical discard/recycle follow-up is now implemented; see [Location lifecycle](location-discard.md). Statements below describing it as pending record this earlier iteration.

2026-10-22: the four Location families now validate active encounter owner, phase, matching public reveal, catalog family and private top card before command effects or direct draw. Foreign Gate metadata and premature removal flags are rejected. Orphan reveals are identified from content IDs and standard Location prefixes. The pure validator does not mutate snapshots or reveal private identities in diagnostics.

Server restoration invokes the same validator before any room mutation, following the existing Research validation to preserve its diagnostic precedence. No wire fields, commands, packages or card effects changed. Current location and decision owner remain independent: effects may move the investigator and offer colleague-owned prevention.

This is a prerequisite for physical discard/recycling, which remains pending. It does not validate the full remaining inventory. New module/tests are committed normally; exact already-applied integration deltas for pre-existing dirty index.ts, GameRoom.ts and GameRoom.test.ts are saved in docs/superpowers/patches/2026-10-22-location-binding-working-tree.patch. Do not apply twice. This depends on the existing working-tree foundation, not a standalone clean checkout.

Independent clean-context review found no material issues and passed24 focused tests. Minor deferred coverage: server test exercises orphan restoration; valid bound restoration and top-mismatch are covered at pure-validator level, not yet explicit room scenarios. Execution evidence and deviations are in docs/superpowers/plans/2026-10-22-location-binding.md.

Verification: root lint/typecheck/build5/5 each; test8/8 tasks,1472 engine,127 content,21 protocol,301 server. Sequential Playwright main7, Norman2 and Spell2 passed. Reverse patch verification uses git apply --unidiff-zero --reverse --check; patch is already applied.
