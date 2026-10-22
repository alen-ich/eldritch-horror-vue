# Research marker binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline.

**Goal:** Preserve and validate original Research marker/token provenance.
**Architecture:** Private optional binding and pure validation integrated with existing continuation guard.
**Tech Stack:** TypeScript, Vitest3.2.7, existing Colyseus0.18.5; no dependency changes.
**Spec:** docs/superpowers/specs/2026-10-22-research-marker-binding-design.md

## Task1 RED→GREEN engine
Create packages/engine/src/research-marker-binding.ts exporting validateResearchMarkerBinding(state:GameState,content:GameContent):string|undefined and packages/engine/test/research-marker-binding.test.ts. Modify clean research-continuation-integrity.ts to call helper. Modify dirty index.ts private pending type and Research draw capture only.
- [x] RED actual draw binding capture; JSON valid/moved/collected/legacy states; redirect nested branch, token replacement, malformed binding and non-Research misuse reject before command effects/RNG and with generic diagnostics.
- [x] Run node node_modules/vitest/vitest.mjs run test/research-marker-binding.test.ts from packages/engine; expect failing behavior.
- [x] GREEN validate typed branch traversal, live marker/token identity; capture at draw; focused/full engine pass.

## Task2 room boundary
Create apps/server/test/ResearchMarkerBinding.test.ts; modify dirty GameRoom.test.ts registration and GameRoom.ts same-active-card binding preservation guard before mutation.
- [x] RED real two-peer valid private binding restore/JSON and stripping/change rejection before mutation; private fields absent on wire.
- [x] GREEN preserve existing binding for active same-card restoration; existing shared validator validates new snapshot contents.
- [x] Independent clean-context reviewer; material findings RED→GREEN, minor ledger.
- [x] pnpm lint/typecheck/test/build and serial main Playwright --workers=1, Norman/Spell configs; expect exit0.
- [x] docs/architecture/research-marker-binding.md; save three dirty integration deltas as exact already-applied zero-context patch, reverse-check --unidiff-zero and diff-check; scoped commit clean/new files/patch only.

## Review Focus
Consumed target vs absent marker; same marker different token; deep inactive branches; legacy missing field; strip binding during active room restore. Task1 first four, Task2 last.

## Ledger
HEAD88ec909, baselines saved for index.ts, GameRoom.ts, GameRoom.test.ts. Spec/plan self-approved; inline current branch authorized. Shared interface Task1→Task2: private pending field and exported validator reached through existing continuation guard. No worktree, push or merge.

Task1 RED8/10, GREEN77/77 including actual Research/Cthulhu suites. Task2 real two-peer RED: missing expected exception when active binding stripped. Added same-active-card preservation check before room writes. No new packages or wire fields.

Independent clean-context review: no material findings, new10/10 independently passed. Minor deferred coverage: explicit actual draw→collect→pause→JSON resume path; synthetic consumed-marker state is covered and existing full Research integrations pass. Root lint/typecheck/build5/5 each and root test8/8 exit0,304 server. Three prior architecture notes now point to completed marker provenance.

Root evidence:1513 engine,127 content,21 protocol,304 server tests. Main Playwright7/7 exit0, dedicated configurations run sequentially. Applied patch reverse-check succeeded; unrelated source unchanged. Hourly automation updated in place to latest marker-binding evidence without changing schedule/status.

Final browser Norman2/2 and Spell2/2 exit0, all11 passed serially. Tasks1–2 complete. No material review findings; minor journey coverage deferred as recorded. Finish current branch with scoped local commit; no push/merge.
