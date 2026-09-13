---
task: Ответ на issue 301 и расширение списка account completion
status: active
approved: 2026-09-13
---

# Account completion в два вызова

Исследование от 2026-09-13. Проверены локальные версии hledger-vscode
`fae085e` и hledger-lsp `7771313`, GitHub issue/PR и исходники VS Code.
Реализация согласована 2026-09-13. Новая функциональность пока не реализована.

## Intent contract

- **Problem:** в [issue #301](https://github.com/juev/hledger-vscode/issues/301)
  пропали подсказки давно объявленных и использованных счетов. В LSP недавно
  появилась фильтрация по ненулевому балансу, но пользователь не может расширить
  список для повторного использования счёта с нулевым балансом.
- **Shipping:** сейчас — проверенное объяснение и предложение для двух
  репозиториев; целевое поведение — обычный список, затем полный список счетов
  по явной команде в том же месте ввода.
- **Not shipping:** сейчас — изменения кода и публикация комментария; в будущую
  реализацию не входят изменения расчёта балансов, inline completion и completion
  для `.rules`.
- **Verification:** история PR/release, чтение пути completion, существующие
  regression tests; для реализации — протокольные тесты и проверка настоящего
  suggest widget в VS Code.

## Что изменилось и зачем

[PR hledger-lsp #75](https://github.com/juev/hledger-lsp/pull/75) merged
2026-09-09 и вошёл в [v0.2.57](https://github.com/juev/hledger-lsp/releases/tag/v0.2.57).
Сервер оставляет счета, у которых хотя бы в одной commodity баланс не равен
нулю. Отрицательный и сколь угодно маленький ненулевой баланс подходят.
Баланс считается по загруженному journal и include-файлам, с исключением
редактируемой транзакции, без ограничения по давности использования.

Фильтр применяется до ограничения числа подсказок. Практический смысл:
счета с нулевым остатком, в том числе закрытые, перестают занимать места в
ограниченном списке. Обратная сторона: объявленный, но ещё не использованный
счёт тоже скрывается, как и действующий счёт с временно нулевым балансом.
Нулевой баланс сам по себе не означает, что счёт больше не нужен.

У PR нет `closingIssuesReferences` или cross-reference на исходный issue;
отдельную исходную задачу поиском в обоих репозиториях не нашли. Ссылаться можно
на текущий #301 и PR #75, не приписывая PR связь с другим issue.

В #301 нет версии LSP, примера journal и баланса отсутствующих счетов. Поэтому
изменение подтверждено, но его связь с конкретным journal автора остаётся
гипотезой. Если отсутствует счёт с ненулевым балансом, нужно отдельно проверить
загруженные includes и ограничение числа результатов.

## Черновик ответа в issue

Yes, account completion changed in [hledger-lsp PR #75](https://github.com/juev/hledger-lsp/pull/75),
released in [v0.2.57](https://github.com/juev/hledger-lsp/releases/tag/v0.2.57).
It now hides accounts whose balances are zero in every commodity. This keeps
zero-balance accounts, including closed accounts, from taking up the limited
suggestion slots.

The filter uses the loaded journal and its includes, excluding the transaction
being edited. It does not hide accounts based on how long ago they were used.
Declared accounts without posting history are also hidden, so this may explain
the accounts missing from your list.

We are considering two-stage completion: show accounts with nonzero balances
first, then allow an explicit action to include zero-balance and unused declared
accounts. The shortcut is still being evaluated; this is not implemented yet.

If any missing account has a nonzero balance outside the transaction you are
editing, please share your LSP version and a minimal journal example so we can
check whether there is another cause.

## Клавиши

По [документации IntelliSense](https://code.visualstudio.com/docs/editing/intellisense)
первый `Ctrl+Space` вызывает completion, а повторный показывает или скрывает
описание выбранной подсказки. `Tab` и `Enter` вставляют выбранное значение.
На macOS здесь тоже используется **Control**, а не Command.

| Вариант | Следствие | Предложение |
| --- | --- | --- |
| Повторный `Ctrl+Space` | Заменяет показ описания в account completion; соответствует предложенному пользователем сценарию. | Основной вариант, с возможностью отключить binding. |
| Отдельная команда `HLedger: Show All Account Suggestions` | Работает из Command Palette и допускает любую пользовательскую комбинацию. | Нужна независимо от основного binding. |
| `Tab` в открытом списке | Вместо вставки выбранного счёта меняет список; поведение зависит от стадии completion. | Не назначать по умолчанию; пользователь может привязать команду сам. |

Описание подсказки остаётся доступно через `Ctrl+I` (`Cmd+I` на macOS) и
кнопку интерфейса, согласно
[регистрации команд VS Code](https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/suggest/browser/suggestController.ts).
Не предлагать `Ctrl+Alt+Space` как свободную замену: он переключает фокус
на описание. `Shift+Tab` также имеет штатные назначения.

Автор #301 уже [сообщал о конфликте Ctrl+Space с другой программой](https://github.com/juev/hledger-vscode/issues/80#issuecomment-3938613821).
Поэтому доступ из Command Palette и переназначение команды нужны для этого
пользователя. Автоматически копировать все пользовательские bindings команды
Trigger Suggest не следует: они могут иметь собственные условия и конфликты.

## Предлагаемое поведение

1. **Открыть список:** обычное автоматическое completion или первый ручной
   вызов показывает текущие подсказки с ненулевыми балансами.
2. **Расширить список:** команда в открытом account completion запрашивает
   все подходящие счета, включая нулевые и объявленные без истории. Ненулевые
   остаются впереди; дополнительные счета следуют за ними. Повтор команды
   сохраняет полный режим, а не переключает обратно.
3. **Продолжить ввод:** полный режим сохраняется при уточнении имени, включая
   `:` и Backspace. После закрытия списка, вставки, перехода к другой позиции
   или редактору следующий сеанс снова начинается с обычного режима.

Под «всеми» здесь понимаются все известные счета, подходящие введённому имени,
из того же набора journal/include-файлов. Для полного account-режима предлагается
снять `completion.maxResults`; иначе повторный вызов может снова скрыть нужный
счёт за тем же лимитом. Обычный режим сохраняет лимит. Это решение о поведении
требует согласования до реализации и проверки на большом journal.

Если обычный список пуст, доступ к полному нельзя привязывать исключительно
к наличию выбранного item. Отдельная команда должна работать и при закрытом
списке; сценарий повторного вызова при пустом результате проверяется в VS Code.

## Как связать клиент и сервер

В [стандартном LSP completion](https://github.com/microsoft/language-server-protocol/blob/gh-pages/_specifications/lsp/3.17/language/completion.md)
нет номера нажатия или стадии списка. `Invoked` объединяет ручной вызов,
обычный ввод и вызов через API; `TriggerForIncompleteCompletions` означает
пересчёт после ввода в неполном списке. Считать число этих запросов нельзя.
`isIncomplete` также не означает «загрузить следующую порцию по клавише»:
новый ответ заменяет список целиком.

Минимальный кандидат — общий генератор на сервере с явно передаваемым режимом
`nonzero | all`. Обычный `textDocument/completion` сохраняет `nonzero`.
Для клиента добавить custom request `hledger/completion` с теми же координатами
и полем `accountScope`; объявить поддержку через experimental capability.
Названия нового метода и capability — предложение, сейчас их нет.
Custom request использует тот же генератор, ranking, text edits и resolve data;
обходятся только balance filter и лимит в полном account-режиме.

В extension команда выставляет режим для текущего ввода и инициирует новый
completion. В проверенных исходниках VS Code main у `editor.action.triggerSuggest`
есть precondition `!suggestWidgetVisible`, а
[`EditorCommand.runEditorCommand`](https://github.com/microsoft/vscode/blob/main/src/vs/editor/browser/editorExtensions.ts)
проверяет precondition и при программном вызове. Поэтому простой вызов команды
поверх открытого списка не сработает. Кандидат для прототипа — последовательно
вызвать `hideSuggestWidget` и `editor.action.triggerSuggest`, сохранив режим
между этими действиями. Проверить отсутствие вставки текста, положение курсора,
выбор item и заметное мигание; отдельно сверить минимальную поддерживаемую
версию VS Code, поскольку здесь прочитан main, а не её исходники.

Completion middleware направляет запрос в обычный или расширенный server handler
и преобразует результат штатным
protocol converter. Новый полный ответ содержит обе группы, поэтому ручное
добавление items из устаревшего ответа не требуется. Режим передаётся в каждом
запросе; глобальные настройки сервера ради одного списка не переключаются.

Binding ограничивается `editorLangId == hledger`, видимостью списка и account
контекстом. VS Code предоставляет
[`suggestWidgetVisible` в when clauses](https://code.visualstudio.com/api/references/when-clause-contexts),
но публичный extension API не предоставляет универсального события закрытия
обычного suggest widget. Поэтому точный сброс режима — главный вопрос для
прототипа. Нельзя считать отмену одного provider request закрытием списка:
обычный повторный запрос тоже может отменять предыдущий.

Прототип должен подтвердить сброс после Escape, принятия мышью или клавишей,
потери фокуса и повторного открытия в той же позиции; отдельно — сохранение
режима при вводе, `:` и Backspace. Если public API не позволяет надёжно
обеспечить этот контракт, нужно вернуться к обсуждению срока действия команды,
а не незаметно оставлять полный режим для всего документа.

Нужно определять account-контекст и при пустом результате. Сейчас каждый
account item несёт `data.kind = account`, но в пустом списке items нет.
Вариант для прототипа — metadata контекста в ответе custom request, чтобы
не переносить Go-парсер контекста в TypeScript. Wire-форму этого ответа
зафиксировать после проверки прототипа.

Старый LSP без capability получает обычные запросы. Расширение предлагает
обновить сервер при явном вызове новой команды и не выдаёт старый ограниченный
ответ за полный. Другие редакторы сохраняют прежнее стандартное completion.
Ответы от отменённых запросов и устаревших версий документа отбрасываются.

## Ориентиры в коде

- hledger-lsp `internal/server/completion.go`, `completion`: анализ без текущей
  транзакции, filter, ranking и `MaxResults`; `rankCompletionItemsByScore`
  задаёт `SortText` и `FilterText`. Простая замена `IsIncomplete` на false
  потребовала бы также пересмотреть фильтрацию клиента, поскольку сейчас
  `FilterText` равен запросу, а не имени счёта.
- hledger-lsp `internal/server/completion_filter.go`,
  `filterNonzeroAccountCompletions`: точная проверка `!balance.IsZero()`.
- hledger-lsp `internal/server/protocol_server.go`, `Completion`, `Request`:
  стандартный handler и существующий custom request `hledger/payeeAccountHistory`.
  `internal/server/server.go`, `Initialize`: объявление capabilities.
- hledger-lsp `internal/server/completion_resolve.go`, `attachResolveData`:
  metadata `kind`, `label`, `docURI`, которую нужно сохранить для resolve.
- hledger-vscode `src/extension/lsp/HLedgerLanguageClient.ts`,
  `createClientOptions`: сейчас completion middleware отсутствует.
  Установленный `vscode-languageclient` поддерживает `provideCompletionItem`
  и `protocol2CodeConverter.asCompletionResult`.
- hledger-vscode `src/extension/main.ts`, `activate`: регистрация команд;
  `package.json`: commands, keybindings и настройки;
  `src/extension/KeybindingHintsStatusBar.ts`: существующая подсказка клавиш;
  `docs/user-guide.md`: документация completion и bindings.
- Тесты: LSP `internal/server/completion_balance_test.go`,
  `completion_test.go`, `protocol_server_test.go`; extension
  `src/extension/lsp/__tests__/HLedgerLanguageClient.test.ts` и
  `src/extension/__tests__/keybindings.test.ts`.

## Последовательность будущей работы

1. **Проверить UI-механику прототипом.** На настоящем VS Code подтвердить новый
   запрос при открытом списке, определение account-контекста и весь цикл сброса
   режима. Отдельно проверить пустой список. Результат — воспроизводимый
   сценарий с протокольным trace, без обращения к приватным API редактора.
2. **Добавить LSP-контракт.** Ввести режим в общем генераторе, custom handler и
   capability. Закрепить wire-форму metadata. Regression tests доказывают
   обычную фильтрацию, полный список, наличие объявленных счетов, сохранение
   text edits/resolve, порядок групп и поведение выше `MaxResults`.
3. **Подключить extension.** Добавить команду, middleware и состояние ввода по
   проверенному прототипу. Tests покрывают выбор server request, capability
   fallback, отмену, устаревший ответ и независимость двух редакторов.
4. **Добавить bindings и подсказку.** Привязать повторный Control+Space только
   в согласованном account-контексте, оставить Tab для принятия. Документировать
   команду и переназначение; проверить настоящие клавиши и обновить user guide.
5. **Проверить вместе и выпустить.** Сначала LSP с новой capability, затем
   extension. Проверить свежий и старый LSP, автоматическое открытие, пустой
   результат, Unicode/CRLF и большой список. После проверки дополнить #301
   фактическими версиями и доступными действиями.

## Verification

В ходе исследования выполнено в hledger-lsp:

```sh
go test ./internal/server -run 'TestCompletion_Nonzero(AccountBalances|AccountsBeforeMaxResults|AccountBalancesAcrossIncludes)$' -count=1
```

Результат: PASS. Покрыты нулевые, отрицательные и маленькие балансы,
несколько commodities, inferred amount, текущая транзакция, лимит,
повторные includes, Unicode и CRLF. Это проверка существующего поведения;
новый UI и новый протокол ещё не проверялись.

После реализации: LSP `go test ./...`, `go test -race ./...`, `go build ./...`,
`golangci-lint run ./...` с версией из CI; extension `npm test`,
`npm run typecheck`, `npm run lint`, `npm run build`. Unit tests с mock VS Code
не заменяют проверку настоящего списка и его закрытия.

## Состояние

Пользователь согласовал начало реализации 2026-09-13. Повторный Ctrl+Space,
полный список без лимита и проверка UI прототипом входят в согласованный scope.
[Комментарий опубликован](https://github.com/juev/hledger-vscode/issues/301#issuecomment-5652044819)
и проверен чтением из GitHub API. Следующий шаг после commit и push этого
документа — прототип обновления списка и сброса режима в настоящем VS Code.

## Changelog

- Round 1: проверены история фильтра, ограничения API и конфликты клавиш;
  подготовлены ответ и предложение для двух репозиториев.
- Round 2: опубликован ответ в #301, пользователь согласовал реализацию.
