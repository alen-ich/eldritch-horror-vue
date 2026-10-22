# Expedition array validation status

2026-10-22: Physical setup now inspects all 18 positions, including absent array slots, before accepting either the content catalog or injected shuffle output. Sparse catalogs reject with EXPEDITION_CONTENT_MISSING before random input; invalid shuffle output rejects with RANDOM_INPUT_REQUIRED and rolls back the transaction. No command, public field, hidden-data projection or live Expedition effect was introduced.

The focused regression covers both edge positions, explicit undefined, duplicates, foreign output, unchanged input, checkpoint rollback invocation and valid reversed output. Combined Expedition suites: 50/50. Independent review found no Critical/Important issues. Deferred minor: the new rollback stub proves invocation, not retained deterministic stream restoration; existing setup tests separately cover depleted deterministic input rollback.

The original expeditions.ts was untracked at the start. To preserve that existing work without claiming it in a new source commit, the iteration saves its exact two-line source delta as `docs/superpowers/patches/2026-10-22-expedition-array-integrity.patch`. It is already applied in this working directory; do not apply it twice. The patch alone is not a standalone implementation: it requires the existing Expedition foundation and exports.

Next dependency: verify existing Location/Research encounter discard/recycling behavior against the repository's recorded Reference Guide rules before expanding executable Expeditions. Other World now has separate inventory work; verify code before assuming the older documented bottom-cycle gap still applies to every family.
