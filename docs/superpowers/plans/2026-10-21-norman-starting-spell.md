# Norman Starting Spell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. User selected native execution in the current session; only the final independent reviewer is delegated.

**Goal:** Выдавать Норману физическое Feed the Mind при обычном старте и законной замене сыщика, открывая уже реализованный cast без fixture gain.

**Architecture:** Content явно объявляет поддержанную стартовую лицевую идентичность; чистый engine использует общий внутренний named gain внутри транзакции внешней команды. Сервер передаёт конфигурацию и случайный ввод; клиент использует существующие intent и front-only projection.

**Tech Stack:** TypeScript, Vitest 3.2.4, Zod 4.6.5, Colyseus 0.18.5/schema 5.0.32, Nuxt 4.5.2/Vue 3.5.42, Playwright 1.63.0. Новых библиотек нет.

**Spec:** `docs/superpowers/specs/2026-10-21-norman-starting-spell-design.md` — одобрена 2026-10-21.

## Global Constraints

- «Не парсить display strings». Исполняемая выдача поддерживает ровно Нормана и `spell_feed_the_mind`.
- «Сервер получает личность из соединения»; новые сетевые команды не нужны.
- «Физический ID, порядок колоды, оборот, изображения оборотов и таблицы исходов остаются на сервере».
- «Не сбрасывать лимиты component usage или Norman ledger при выдаче и замене»; обычная инициализация нового START_GAME сохраняется.
- «Старые активные комнаты не получают ретроактивных карт при восстановлении или reconnect».
- «Минимальные синтетические content fixtures без объявленной стартовой выдачи продолжают работать».
- «Не менять ветку и не создавать worktree; никаких commit/push/merge/deploy».
- Сохранить все исходные tracked/untracked изменения; отдельно записывать добавленные этой задачей фрагменты.
- Другие стартовые Spells, торговля/награды, остальные способности Norman и полная готовность семейства вне объёма.

## Review Focus

1. Повторный reconnect старой комнаты без карты не должен превращаться в бесплатную выдачу (Task 3).
2. Обе копии на чужих/побеждённых листах: замена Norman успешна без изъятия карт, физический итог 20 (Task 2).
3. Ошибка последнего shuffle после успешного setup должна откатить все ранее взятые deterministic inputs, не только named search (Task 2).
4. Смена физической копии в старой Norman fixture после новой выдачи не должна дублировать hidden ID (Task 3).
5. Случайная неудача начального Lore и любой оборот не должны делать production browser journey случайно падающим (Task 4).

## File Map и контракты

- `packages/content/src/investigators.ts`: optional `startingSpellIds?: readonly SpellFrontId[]` в `InvestigatorData`; значение `["spell_feed_the_mind"]` только у Norman. Отсутствие значит, что исполняемая выдача не объявлена, а не что у сыщика по правилам нет стартового заклинания. Runtime schema и `validateInvestigatorContent` запрещают дубли, неизвестные IDs и эту запись у другого сыщика. Существующий export через content/index.ts достаточен.
- `packages/engine/src/index.ts`: тот же optional контракт в `InvestigatorSetup`; вызов общего helper из START_GAME/REPLACE_INVESTIGATOR, внешняя RNG-транзакция только для этих команд с объявленной выдачей. Существующие ограничения pending cast остаются раньше нового dispatch.
- Новый `packages/engine/src/starting-spells.ts`: `validateStartingSpells(content: GameContent): string | undefined`; `grantStartingSpells(state: GameState, playerId: string, content: GameContent, context: EngineContext): CommandResult`; `withStartingSpellRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult`. Использовать type-only imports из index, существующий `gainSpell` из spells; не импортировать content/runtime framework. Export из index для unit tests.
- `apps/server/src/rooms/GameRoom.ts`: передать поле в baseGameContent; для REPLACE_INVESTIGATOR обеспечить shuffle произвольного актуального размера через существующий `serverMythosContext()`, сохранив способность перемешивать Clue discard.
- Тесты: content/investigators.test.ts; новые engine/starting-spells.test.ts, engine/starting-spell-transactions.test.ts; server/StartingSpells.test.ts с регистрацией в GameRoom.test.ts; новый `tests/e2e/starting-spell.spec.ts` под production playwright.config.ts.
- Совместимость фикстур: server/NormanSpellCasting.test.ts и server/test/fixtures/spell-casting-server.ts. Изменять только создание удерживаемой копии, сохраняя deterministic casting и текущие сценарии.
- Документация: четыре файла из спецификации и журнал в конце этого плана.

## Task 1: Типизированное стартовое соответствие

**Files:** modify `packages/content/src/investigators.ts`, `packages/engine/src/index.ts`; tests `packages/content/test/investigators.test.ts`, новый `packages/engine/test/starting-spells.test.ts`; create `packages/engine/src/starting-spells.ts`.

**Interfaces:** optional `startingSpellIds?: readonly SpellFrontId[]` на обеих setup моделях; `validateStartingSpells(content: GameContent): string | undefined`. Ошибки границы engine возвращаются как существующий `SPELL_CONTENT_MISSING`; сообщения не содержат закрытых значений.

- [x] **RED:** content test `declares only Norman's executable starting front` проверяет Norman `["spell_feed_the_mind"]` и отсутствие непустых массивов у остальных. Параметризовать runtime invalid cases: `spell_unknown`, два одинаковых IDs, `spell_wither`, Feed the Mind у Lily. `validateInvestigatorContent` бросает для каждого. Сохранить 12 сыщиков и печатный `startingEquipment` без изменения.
- [x] Запустить `pnpm --filter @eldritch/content exec vitest run test/investigators.test.ts`; зафиксировать падение нового assertion до изменения content.
- [x] **GREEN:** добавить optional поле и schema; разрешать только Norman/Feed the Mind, без парсинга строк. Engine validator независимо проверяет runtime значения как неизвестный ввод, принадлежность investigator ID, уникальность, наличие соответствующих kind в `content.spells`. Пустое/отсутствующее поле не требует каталога. ID front преобразуется в существующий kind `feed_the_mind` только после проверки.
- [x] Добавить engine assertions `validateStartingSpells(minimalContent) === undefined`, invalid mappings/catalog → определённая ошибка; повторить RED→GREEN для engine validation перед его реализацией.
- [x] Проверить `pnpm --filter @eldritch/engine exec vitest run test/starting-spells.test.ts` и content test; оба exit 0. Не добавлять production grant до Task 2.

## Task 2: Атомарная выдача при старте и замене

**Files:** modify `packages/engine/src/index.ts`, `packages/engine/src/starting-spells.ts`; tests `packages/engine/test/starting-spells.test.ts`, create `packages/engine/test/starting-spell-transactions.test.ts`; reuse spell-fixtures.ts без изменения общего setup, если это не требуется новым тестам.

**Interfaces:** `grantStartingSpells(state, playerId, content, context): CommandResult` version-neutral, возвращает новый state и публичные SPELL_GAINED события из `gainSpell`. `withStartingSpellRandomTransaction(context, run): CommandResult` checkpoint/commit/rollback для context с checkpoint; для stateless context без checkpoint запускает callback и переводит thrown RNG failure в `SPELL_RANDOM_INPUT_INVALID`. Stateless crypto не имеет сохраняемой очереди; не заявлять откат системной энтропии. Существующие deterministic contexts имеют checkpoint и должны откатываться полностью.

- [x] **RED:** test `starts Norman with one conserved Feed the Mind` создаёт lobby Norman+Mark с объявленным mapping, START_GAME, затем `heldByPlayer.host.length === 1`, public `spellIds === ["spell_feed_the_mind"]`, deck length 19, validateSpellInventory undefined, version +1, actions 2, usedPhysicalIds empty. Вводы shuffle покрывают получение каждой копии отдельно. До реализации ожидается пустая рука.
- [x] Запустить `pnpm --filter @eldritch/engine exec vitest run test/starting-spells.test.ts`; убедиться в поведенческом FAIL.
- [x] **GREEN:** `grantStartingSpells` вызывает существующий `gainSpell` с `{type:"kind",kind:"feed_the_mind"}`; нет прямого splice или выбора обратной стороны. START_GAME сначала сохраняет существующий порядок всех setup RNG и createSpellInventory, потом grants по порядку seats. Копировать aggregate events, а не терять Mystery/Monster/Clue events. Внешний command сохраняет единственный +1.
- [x] **RED:** `replacement grants only available physical supply` покрывает 2/1/0 доступных копий, владения живого коллеги и defeated sheet, пустой deck с корректной консервацией; Norman получает только доступную копию, отсутствие не отменяет replacement. Предыдущие held копии уже перенесены поражением; не переносить их обратно. Lily replacement по-прежнему без Spells. Проверять весь inventory и version +1.
- [x] Запустить тот же тестовый файл, увидеть FAIL отсутствующей выдачи при replacement; затем **GREEN:** в REPLACE_INVESTIGATOR после разрешённого обновления actor и Assets/refill применить общий helper. Не менять текущий round ledger или usedPhysicalIds. Требовать context при непустой конфигурации и применять named-gain shuffle даже при отсутствии доступной копии по существующим правилам helper.
- [x] **RED:** transaction file тестирует точное равенство входного state после rejected START_GAME/REPLACE_INVESTIGATOR: missing catalog, unknown mapping, malformed inventory, RNG throw/invalid permutation при завершающем named shuffle. Сравнить дальнейший вызов rollDie/drawToken/createId/shuffle с нетронутым контрольным deterministic context: полный rollback всех уже использованных очередей. При success сравнить с ожидаемым потреблением, без двойного commit.
- [x] Запустить `pnpm --filter @eldritch/engine exec vitest run test/starting-spell-transactions.test.ts`, увидеть FAIL rollback до реализации. **GREEN:** валидировать mapping до RNG; обернуть целиком executeCommandImpl для START_GAME/REPLACE_INVESTIGATOR с объявленной выдачей, а не только helper. На ошибке не публиковать копию state и вернуть существующие коды. Синтетические команды без mapping сохраняют прежний dispatch.
- [x] Добавить negative cases unknown actor, non-host/repeated start, wrong replacement timing, terminal state; при отказе version/inventory/ledger неизменны. Проверить отсутствие повторного grant при unrelated command. Сравнить Mystery/Reserve/прочие setup результаты с контрольным стартом без mapping при одинаковом предшествующем RNG.
- [x] Проверить `pnpm --filter @eldritch/engine test` и `pnpm --filter @eldritch/engine typecheck`; exit 0. Не менять старые empty-inventory ожидания для fixtures без mapping или Lily.

## Task 3: Production room, восстановление и совместимость fixtures

**Files:** modify `apps/server/src/rooms/GameRoom.ts`, `apps/server/test/GameRoom.test.ts`, `apps/server/test/NormanSpellCasting.test.ts`, `apps/server/test/fixtures/spell-casting-server.ts`; create `apps/server/test/StartingSpells.test.ts`.

**Interfaces:** `registerStartingSpellRoomTests(getServer: () => ColyseusTestServer<typeof config>): void` по образцу registerNormanSpellCastingRoomTests. Сеть использует существующий `{expectedStateVersion, command}`; public player.spellIds/castableSpellIds не меняют форму. Приватные snapshot helpers доступны только тестам.

- [x] До изменения server adapter выполнить первые два шага Task 4 и сохранить browser RED; затем закончить Task 3 и вернуться к GREEN Task 4. Это единственное заранее заданное пересечение порядка задач.
- [x] **RED:** два клиента обычной game room выбирают Norman+Mark, Azathoth, START_GAME без внутреннего gain. Оба видят только `spell_feed_the_mind`, внутренне 19+1 и всего 20, версия ровно +1. Запустить `pnpm --filter server exec mocha -r tsx test/GameRoom.test.ts --exit --timeout 15000 --grep "starting Spell"`; ожидать FAIL отсутствующей карты до server adapter.
- [x] **GREEN:** передать `startingSpellIds` из content в server GameContent. Для замены заменить ограниченный shuffleIndexes-only context на `serverMythosContext()`; доказать room replacement с непустой Spell supply и Clue recycling. Production RNG остаётся серверным и не выбирает фиксированную копию.
- [x] RED→GREEN тесты: stale START_GAME, non-host start, replay replacement и чужой cast не изменяют state; легальный Norman cast вызывает существующий owner-only test choice. После разрыва соединения тот же seat восстанавливает руку/решение без выдачи; второй room остаётся неизменным. Snapshot JSON restore сохраняет exact inventory и ledgers. Legacy active snapshot с пустой рукой остаётся пустым. Повреждённый inventory rejected до изменения комнаты.
- [x] Проверить serialization state обоих клиентов и полученных choices: отсутствуют `/spell_[a-z_]+_0[12]|heldByPlayer|heldByDefeatedInvestigator|sourcePhysicalId|feedTheMindByPhysicalId|private-card-assets/`; владельческие варианты не поступают гостю. Закрытые данные не включать в test failure dumps публичных payloads.
- [x] Обновить Norman casting fixture: использовать уже полученную production карту; если конкретный тест требует copy 01, выполнить приватный test-only swap held copy с копией в deck, сохраняя ровно 20 и validateSpellInventory. Не повторять gain и не добавлять held copy в deck при дублированном named gain. В browser fixture выполнять ручную выдачу только для сценария Jim, не для Norman; для Norman разрешён такой же conserved swap, чтобы сохранить старые deterministic reverse assertions.
- [x] Проверить `pnpm --filter server test` (включая предыдущие Norman/casting/privacy tests) и `pnpm --filter server typecheck`; exit 0. Новая production проверка не использует seeded gain fixture.

## Task 4: Обычный browser путь без fixture gain

**Files:** create `tests/e2e/starting-spell.spec.ts`; существующий production `playwright.config.ts` автоматически включает новый файл. UI менять не требуется; при обнаружении реального препятствия сначала воспроизвести его тестом и записать отклонение.

**Interfaces:** только видимые UI controls и production room; ни server subclass, ни evaluate для изменения canonical state. Два независимых browser contexts, dispose в finally.

- [x] **RED (выполнить перед GREEN Task 3):** добавить `Norman starts with Feed the Mind and restores its owner decision`. Создать game, присоединить Mark, выбрать Azathoth, стартовать. В Spell inventory Norman видит Feed the Mind, Mark — свою пустую руку. На baseline до server adapter тест падает на отсутствии стартовой карты; зафиксировать этот RED запуск, не откатывая код.
- [x] Выполнить `pnpm exec playwright test tests/e2e/starting-spell.spec.ts --workers=1`. Использовать assertions получения synchronized state перед следующей командой, а не timeouts/sleeps.
- [x] **GREEN:** после предыдущих задач production выдача делает путь доступным. Открыть Cast, дождаться owner reroll decision (у Norman 7 Sanity, 0 Clues), проверить отсутствие у Mark, reload Norman и восстановление того же UI. Выбрать Keep result без затрат. Завершить любую разрешённую ветку: при успехе self target + improve will once, при reverse optional choice безопасный discard/decline. При неудаче initial Lore не требовать target; обе копии допускают конечный результат. Ограничить цикл количеством существующих стадий (не более 6), неожиданная стадия — FAIL. Проверить `Your action · 1 remaining`, отсутствие pending dialog, cast повторно недоступен; при discard кнопка отсутствует, при сохранении карты disabled. Владение может сохраниться либо карта законно уйти в supply.
- [x] Повторить focused browser test до exit 0; затем `pnpm exec playwright test --config playwright.spell-casting.config.ts` проверяет оба прежних deterministic сценария. Не запускать одновременно со сборкой Nuxt. Отдельные deterministic unit/room tests доказывают каждую ветку; production browser test не повторять до случайного успешного броска.

## Task 5: Документация, независимая рецензия и итоговая проверка

**Files:** modify `docs/rules/base-game-spells.md`, `docs/rules/base-game-investigators.md`, `docs/exec-plans/base-game-rules-implementation.md`, `docs/project-owner-guide.md`; append execution log to this plan.

**Interfaces:** не меняются. Документировать Norman-only старт/замену, depleted supply, отсутствие ретроактивной выдачи и оставшиеся ограничения. Family readiness по-прежнему needs_review; не объявлять все starting_possessions verified.

- [x] Записать по каждой задаче RED/GREEN команды, exit codes, число тестов и обоснованные отклонения. Исторические результаты не выдавать за текущие. Сопоставить task diff с исходными tracked/untracked изменениями.
- [x] Выполнить последовательно `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --filter server test`, `pnpm --filter server exec tsx scripts/verify-spell-back-privacy.ts`, `pnpm exec playwright test --config playwright.spell-casting.config.ts`, `pnpm test:e2e`. Проверить `git diff --check`. Ошибки диагностировать через superpowers:systematic-debugging. При flaky parallel E2E сохранить trace, определить доказанную причину и отдельно выполнить `pnpm test:e2e --workers=1`; не считать этот результат исправлением parallel run.
- [x] Использовать superpowers:requesting-code-review и вызвать ровно одного независимого reviewer через subagent с `fork_turns: "none"`. Передать абсолютный root, эту spec/plan и список только task-owned изменений; попросить read-only review корректности, транзакций, conservation, privacy и тестовых пробелов с file/line evidence. Все pre-existing изменения reviewer не должен приписывать этой задаче.
- [x] Каждое существенное подтверждённое замечание сначала воспроизвести падающим тестом, затем исправить и повторить затронутые проверки. После code fixes заново прогнать четыре root команды, server/privacy и затронутые Playwright. Не делегировать реализацию и не создавать второго reviewer.
- [x] Использовать superpowers:verification-before-completion перед заявлением готовности. Зафиксировать финальные фактические результаты/ограничения; никаких Git публикаций.

## Самопроверка плана

Спецификация покрыта: typed mapping/валидация → Task 1; start/replacement/depletion/version/rollback → Task 2; server authority, privacy, snapshots, legacy reconnect и fixtures → Task 3; обычный browser путь и случайные ветви → Task 4; документы, fresh reviewer и все команды → Task 5. Пять Review Focus имеют конкретные assertions в задачах. Optional `startingSpellIds` одинаков в content/engine/server; front ID преобразуется в существующий kind только после проверки. Нового protocol API нет.

Уточнение реализации RNG: стартовый serverMythosContext использует stateless crypto, а существующая замена использует ограниченную deterministic shuffle очередь. План сохраняет rollback всех сохраняемых deterministic очередей на внешней команде и переводит replacement production на stateless shuffle, без обещания отменить системную энтропию. Это не меняет игровых исходов при отказе и не создаёт новый RNG subsystem.

Самопроверка не выявила отсутствующих требований или противоречащих интерфейсов. Пользователь одобрил план ответом «да». Выполнен самостоятельно в текущей сессии через executing-plans, с единственным независимым reviewer в конце.

## Журнал выполнения

2026-10-21: спецификация одобрена. Выполнено только чтение кода и подготовка плана; продуктовые изменения и тестовые запуски не выполнялись.

### Execution and review — 2026-10-21

All five tasks completed. No commits, pushes, merges, deployments or worktrees. Session baseline and task-only review package are preserved in `.superpowers/sdd/2026-10-21-norman-starting-spell/`.

RED→GREEN evidence:
- Content mapping: 5 failures for missing/unsupported mappings → 9/9 investigator cases pass.
- Engine validator: 7 missing-function failures → 7/7; grant behavior: 4 missing-grant failures → passing start/replacement scenarios covering both copies. Transaction tests reproduced consumed deterministic prefixes (5 failures) → all 7 passing. New engine suites total 21/21; full engine 1213/1213.
- Production room: expected ordinary-start held count 0 instead of 1 before adapter → new room cases pass, full server 235/235. Production browser: missing held Feed the Mind before adapter → current ordinary setup/cast/reload/completion journey passes.
- Independent read-only reviewer with clean context found no Critical/Important defects and independently ran 21 engine cases. Minor test claim about Clue recycling corrected with a separate real Akachi replacement regression; no production defect or additional reviewer. Review record: scratch `review.md`.

Rulings/deviations:
- Native PowerShell ledger/baseline snapshots replace POSIX bookkeeping scripts on Windows; no worktree or commits by explicit instruction.
- Separate `starting-spell-fixtures.ts` avoids importing test suites into each other.
- Updated only `starting_possessions` readiness notes in addition to specified documents; status remains `needs_review`.
- Production stateless crypto has no retained RNG queue to restore. Deterministic contexts roll back the entire external setup/replacement command using checkpoint, not merely the final Spell operation. Replacement now uses existing arbitrary-size server shuffle, preserving Clue recycling.
- Used existing repository `.superpowers/pnpm.cmd` and PATH prefix to run pinned pnpm 10.28.0. Global standalone pnpm 12 stalled; bundled fallback 11 failed an automatic dependency check with SQLite. No dependency versions, manifest, or lockfile were changed. Actual installed Vitest is 3.2.7 (the plan listed its declared minimum 3.2.4).
- Sandbox loopback reproduced `EACCES connect 127.0.0.1`; local network/browser checks ran with automatically approved escalation. One sandbox Playwright launch held a port until its own session was stopped; a retry then established the intended behavior-level browser RED.

### Final verification

| Command | Actual final result |
| --- | --- |
| `pnpm lint` | Exit 0; 5/5 tasks |
| `pnpm typecheck` | Exit 0; 5/5 tasks |
| `pnpm test` | Exit 0; 8/8 tasks: engine 1213, content 104, protocol 20, server 235 (1572 cases total); web typecheck |
| `pnpm build` | Exit 0; 5/5 tasks |
| `pnpm --filter server test` | Exit 0; 235 passing, real multiplayer included |
| `pnpm --filter server exec tsx scripts/verify-spell-back-privacy.ts` | Exit 0; 228 built text artifacts; reverse image hash exclusion passed |
| `pnpm exec playwright test --config playwright.spell-casting.config.ts` | Exit 0; 2/2 with configured worker selection (one worker for this file) |
| `pnpm test:e2e` | Exit 0; 5/5 with three workers, including the new production starting-card journey |
| `git diff --check` | Exit 0 |

The initial dedicated Spell browser run timed out waiting for Decline after Lily's improvement (1/2). The initial default browser run timed out in the existing Personal Assistant free-reroll scenario (4/5). Traces/logs are preserved; no single established cause is claimed. A later diagnostic run briefly overlapped two Nuxt dev servers and was stopped; it is not counted as final verification. Final suites above were strictly sequential and both passed. No `--workers=1` workaround was needed for the final all-green default run. Earlier transient failures remain a test stability limitation, not a claimed fix.

Existing Nuxt devtools-hook, color environment and Turbo no-output warnings are non-fatal. No full-family Spell support, other starting Spells, additional Norman abilities, rewards/trading or durable persistence is claimed. Reconnect does not migrate old active games by granting missing cards.

Compared initial hashes: all 63 pre-existing files outside the task-owned change list remain byte-for-byte unchanged. Task-owned edits to already modified files were compared with their saved session baseline; unrelated prior hunks were preserved. Current branch and HEAD remain unchanged.
