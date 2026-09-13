---
task: Ответ на issue 301 и расширение списка account completion
status: active
approved: 2026-09-13
---

# Account completion в два вызова

Исследование от 2026-09-13. Проверены локальные версии hledger-vscode
`fae085e` и hledger-lsp `7771313`, GitHub issue/PR и исходники VS Code.
Реализация согласована 2026-09-13. По результатам прототипа пользователь
согласовал срок действия полного режима: до завершения ввода текущего имени
счёта, независимо от временного закрытия списка.

## Intent contract

- **Problem:** в [issue #301](https://github.com/juev/hledger-vscode/issues/301)
  пропали подсказки давно объявленных и использованных счетов. В LSP недавно
  появилась фильтрация по ненулевому балансу, но пользователь не может расширить
  список для повторного использования счёта с нулевым балансом.
- **Shipping:** комментарий в issue и реализация в двух репозиториях: обычный
  список, затем полный список счетов по явной команде для текущего имени счёта.
- **Not shipping:** изменения расчёта балансов, inline completion, поведения
  completion для `.rules` и публикация release.
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

## Опубликованный ответ в issue

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

## Согласованное поведение

1. **Открыть список:** обычное автоматическое completion или первый ручной
   вызов показывает текущие подсказки с ненулевыми балансами.
2. **Расширить список:** команда в открытом account completion запрашивает
   все подходящие счета, включая нулевые и объявленные без истории. Ненулевые
   остаются впереди; дополнительные счета следуют за ними. Повтор команды
   сохраняет полный режим, а не переключает обратно.
3. **Продолжить ввод:** полный режим сохраняется при уточнении имени, включая
   `:` и Backspace, а также закрытие и повторное открытие списка. Принятие
   подсказки, переход к сумме, выход курсора за имя счёта или смена редактора
   сбрасывают режим. Перемещение внутри имени счёта сохраняет его.

Под «всеми» здесь понимаются все известные счета, подходящие введённому имени,
из того же набора journal/include-файлов. Для полного account-режима снят
`completion.maxResults`; иначе повторный вызов может снова скрыть нужный
счёт за тем же лимитом. Обычный режим сохраняет лимит. Решение согласовано.

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
Сервер объявляет `experimental.hledgerCompletion.accountScope = true`.
Custom request использует тот же генератор, ranking, text edits и resolve data;
обходятся только balance filter и лимит в полном account-режиме.

В extension команда выставляет режим для текущего ввода и инициирует новый
completion. В проверенных исходниках VS Code main у `editor.action.triggerSuggest`
есть precondition `!suggestWidgetVisible`, а
[`EditorCommand.runEditorCommand`](https://github.com/microsoft/vscode/blob/main/src/vs/editor/browser/editorExtensions.ts)
проверяет precondition и при программном вызове. Поэтому простой вызов команды
поверх открытого списка не сработает. Команда сначала получает полный ответ,
затем последовательно вызывает `hideSuggestWidget` и
`editor.action.triggerSuggest`. Middleware использует подготовленный ответ
без второго server request. На VS Code 1.137.0 проверены клавиши, состав
списка и отсутствие вставки текста при расширении.

Completion middleware направляет запрос в обычный или расширенный server handler
и преобразует результат штатным
protocol converter. Новый полный ответ содержит обе группы, поэтому ручное
добавление items из устаревшего ответа не требуется. Режим передаётся в каждом
запросе; глобальные настройки сервера ради одного списка не переключаются.

Binding ограничивается `editorLangId == hledger`, видимостью списка и account
контекстом. VS Code предоставляет
[`suggestWidgetVisible` в when clauses](https://code.visualstudio.com/api/references/when-clause-contexts),
но публичный extension API не предоставляет универсального события закрытия
обычного suggest widget. Прототип подтвердил, что Escape не отменяет token
завершённого provider request, а Backspace может выглядеть как новый Invoke.
Поэтому пользователь согласовал привязку режима к текущему имени счёта.
Смена окна сама по себе его не сбрасывает; смена редактора сбрасывает.

Нужно определять account-контекст и при пустом результате. Сейчас каждый
account item несёт `data.kind = account`, но в пустом списке items нет.
Custom response содержит `completionList` и необязательный `accountRange`:
UTF-16 диапазон имени счёта присутствует даже при пустом account-списке и
отсутствует в остальных контекстах. Клиент отслеживает изменения диапазона,
не дублируя Go-парсер контекста. Status bar показывает текущий режим и
позволяет расширить пустой список.

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

## Этапы реализации

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
5. **Проверить вместе.** Проверить свежий и старый LSP, автоматическое открытие,
   пустой результат, Unicode/CRLF и большой список. Для последующего выпуска
   сначала нужен LSP с новой capability, затем extension. После отдельного
   выпуска можно дополнить #301 фактическими версиями и доступными действиями.

## Verification

В ходе исследования выполнено в hledger-lsp:

```sh
go test ./internal/server -run 'TestCompletion_Nonzero(AccountBalances|AccountsBeforeMaxResults|AccountBalancesAcrossIncludes)$' -count=1
```

Результат: PASS. Покрыты нулевые, отрицательные и маленькие балансы,
несколько commodities, inferred amount, текущая транзакция, лимит,
повторные includes, Unicode и CRLF. Это проверка существующего поведения;
дополнительно проверен полный ответ для повторных includes.

Проверки реализации:

- LSP: `go test ./...`, `go test -race -coverprofile=... -covermode=atomic ./...`,
  `go build ./...` и `golangci-lint v2.12.2 run ./...` прошли. Новые тесты
  проверяют оба режима через JSON-RPC, пустой список, Unicode/CRLF, resolve,
  предел результатов и 5000 объявленных счетов. После дополнения тестов
  includes и большого списка повторены соответствующие тесты с `-race` и lint.
- Extension, Node 22.23.1: `npm run typecheck`, `npm run typecheck:test`,
  `npm run lint`, `npm run test:coverage` и `npx vsce package` прошли.
  805 тестов; coverage thresholds из CI соблюдены.
- VS Code 1.137.0, отдельный профиль, собранный LSP и настоящий LanguageClient:
  Ctrl+Space дал один ненулевой счёт, повтор добавил нулевой и неиспользованный.
  Расширение не изменило текст. Escape/reopen и Backspace сохранили полный
  режим; принятие через Tab и мышью вернуло следующий запрос к `nonzero`.
  Command Palette открыл полный список после пустого обычного ответа.
  Сброс при изменении суммы, строки и редактора дополнительно покрыт unit tests.
- Тот же сценарий `Ctrl+Space → Ctrl+Space → Tab` прошёл с полным production
  bundle extension и его manifest bindings. В чистом тестовом профиле custom
  LSP запущен командой `HLedger: Restart Language Server`.

Минимальная заявленная VS Code 1.110 отдельно не запускалась; runtime-проверка
выполнена на установленной 1.137.0. Сценарий проверяется без private API.

## Состояние

Пользователь согласовал начало реализации 2026-09-13. Повторный Ctrl+Space,
полный список без лимита и проверка UI прототипом входят в согласованный scope.
[Комментарий опубликован](https://github.com/juev/hledger-vscode/issues/301#issuecomment-5652044819)
и проверен чтением из GitHub API. План сохранён в commit `a9063c7` и отправлен
в отдельную ветку до начала реализации. Код подготовлен в ветках
`feat/account-completion-stages` обоих репозиториев; release не публиковался.

## Changelog

- Round 1: проверены история фильтра, ограничения API и конфликты клавиш;
  подготовлены ответ и предложение для двух репозиториев.
- Round 2: опубликован ответ в #301, пользователь согласовал реализацию.
- Round 3: прототип выявил ограничения событий закрытия; пользователь
  согласовал привязку полного режима к текущему имени счёта. Реализованы
  протокол, middleware, команда, binding, подсказка режима и тесты.
