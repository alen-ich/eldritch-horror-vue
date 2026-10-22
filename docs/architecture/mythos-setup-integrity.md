# Staged Mythos setup integrity

2026-10-22: Mythos setup now validates dense unique nonempty card IDs, legal colors and exactly three dense stage records before consuming RNG. Existing count/shortage checks remain. Each color pool and stage passes through the checked physical permutation helper; provider input/output references are isolated. Stage order and counts, unselected-card exclusion, empty color pools and intentionally empty stages remain supported.

No live card/icon/Rumor rule or readiness status changed. Only server-private setup order is affected; command/public interfaces and existing transaction exception mapping remain unchanged. Other shuffle/setup/recycling boundaries are separate audits.

TDD reproduced 45 failing cases before correction, then 123/123 focused cases passed across six suites. Tests include all six shuffle sites, malformed arrays/records, provider buffer reuse and real START_GAME rejection with deterministic-input rollback. Full verification, independent review and execution details: `docs/superpowers/plans/2026-10-22-mythos-setup-integrity.md`.
