# Dense generic encounter instructions

2026-10-22: the shared Location/Other World parser now visits every sequence.steps and choice.options slot before recursive validation. Sparse slots reject exactly like explicit undefined/null or their JSON representation; they no longer survive map/some and reach execution. Dense order, empty sequences, empty-choice refusal and source immutability remain unchanged. Research authored compilation already has its separate dense boundary.

Invalid Location content returns existing ENCOUNTER_UNSUPPORTED before physical draw, state mutation or random consumption. No public field, network command, runtime continuation, printed card rule, framework API or dependency changes. The engine remains pure and server-authoritative.

RED6/12 reproduced sparse root/nested sequence/choice, all-hole choice and actual Location failure classification. GREEN519/519 focused cases includes12 new,19 Location and488 Other World. Independent clean-context reviewer found no material issue and independently passed519/519. Minor deferred coverage: explicit valid nested sequence/choice control; existing encounter suites cover compatibility broadly.

The touched parser was clean at entry and new tests/docs belong to this iteration; no integration patch is necessary. Execution evidence and final results: docs/superpowers/plans/2026-10-22-encounter-dense-instructions.md.

Final verification: pnpm lint/typecheck/build5/5 tasks each exit0; pnpm test8/8 with1525 engine,127 content,21 protocol,304 server tests. Serial Playwright main7/7, Norman2/2, Spell2/2 passed.
