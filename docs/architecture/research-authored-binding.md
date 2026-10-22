# Research authored binding boundary

Current status: new Research draws now retain explicit original marker/token provenance; see [Research marker binding](research-marker-binding.md). Earlier pending statements below are historical.

2026-10-22: bindResearchInstruction now rejects runtime-only collect_encountered_clue/relocate_encountered_clue effects in authored card sections. Authored encountered_clue gain/relocate syntax still compiles using the server-selected marker, regardless of any extra source markerId. Nested tests, sequences, optional rewards and ambush branches enforce the same boundary. Optional costs already rejected these runtime effects through the existing generic parser and retain that behavior.

Sequence compilation now visits every array slot, rejecting sparse input like its JSON null equivalent. Invalid sections fail as ENCOUNTER_UNSUPPORTED before physical draw, random input or state mutation. No new public field, client command, package, card effect or runtime continuation format changed. Saved bound continuations bypass this authored compiler and remain supported. Explicit persisted origin-marker provenance remains a separate dependency.

RED12/16 reproduced accepted target overrides, sparse sequence and actual engine execution. GREEN83/83 includes the new16 and existing Research34/Cthulhu33 support tests. Independent clean-context reviewer found no material findings and independently passed83/83; minor unused-import and duplicate test-token cleanup applied. Source file was clean at iteration entry, so no integration patch is needed. Full results and decisions: docs/superpowers/plans/2026-10-22-research-authored-binding.md.

Final verification: pnpm lint/typecheck/build5/5 tasks each exit0; pnpm test8/8 with1503 engine,127 content,21 protocol,303 server tests. Sequential Playwright main7/7, Norman2/2 and Spell2/2 passed.
