# Gate/Artifact setup shuffle integrity

2026-10-22: Both pure setup builders now require dense unique string catalogs, pass copies to the injected shuffle provider, validate exact physical identity conservation and return independently owned arrays. Artifact pattern and Gate nonempty-string compatibility remain unchanged. Provider mutation cannot redefine the expected catalog or modify caller input; retained output cannot mutate engine storage.

No commands, public projection, package dependencies or printed rules changed. Original setup transaction exception mapping remains in force (including SPELL_RANDOM_INPUT_INVALID for the tested starting-Spell fixture). This is a provider-boundary correction, not a client authorization change or an Artifact readiness claim. Other setup/recycling sites remain separate audits.

New tests exercise malformed/sparse catalogs/output, foreign/duplicate/omitted/extra IDs, valid in-place and frozen providers, retained references in both directions and real START_GAME rejection with input/RNG rollback. A mutation run against the original setup.ts reproduced 24/35 failures. Final checks/review: `docs/superpowers/plans/2026-10-22-physical-setup-shuffle.md`.
