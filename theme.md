## Цель
Добавить в расширение настраиваемые цвета подсветки синтаксиса hledger так, чтобы:
- хранились ключи цветов по реальным токенам (например: `date`, `amount`, `account`, …);
- изменение цветов не влияло на скорость отрисовки редактора;
- решение было совместимо с текущей грамматикой TextMate и темами VS Code.

Примечание: это намеренно использует «семантические» названия токенов в ключах настроек, в отличие от прежнего варианта с безымянными слотами.

## Текущее состояние
- Грамматика: `syntaxes/hledger.tmLanguage.json` определяет множество `scope` (TextMate): даты, счета, суммы, товары (commodities), получатели (payees), комментарии, теги, директивы, статусы, коды и т. д.
- Дефолтная раскраска: в `package.json` в `contributes.configurationDefaults.editor.tokenColorCustomizations.textMateRules` заданы статические цвета для ряда `scope`.
- Несоответствие: в дефолтных правилах есть `markup.underline.link.url.hledger`, а в грамматике — `markup.underline.link.hledger`. Это стоит выровнять.

## Варианты реализации
1) TextMate + editor.tokenColorCustomizations (предпочтительно)
- Генерировать `textMateRules` для наших `scope` и класть их в `editor.tokenColorCustomizations`.
- Плюсы: нулевая нагрузка на рендер (все делает движок VS Code), кросс‑платформенно, не требует декораций.
- Минусы: нужно бережно сливать с пользовательскими кастомизациями, чтобы ничего не перетирать.

2) Собственная тема (`contributes.themes`)
- Плюсы: нативная интеграция с темами.
- Минусы: неудобно для гибкой настройки на уровне пользователя/рабочего пространства; не решает задачу «хранить только ключи палитры».

3) Семантические токены
- Плюсы: современный механизм VS Code.
- Минусы: текущая подсветка основана на TextMate; внедрение semantic tokens потребует значительной перестройки и не даст выигрыша против варианта 1 по перфомансу.

4) Декорации (`createTextEditorDecorationType`)
- Плюсы: полный контроль из кода.
- Минусы: ощутимая нагрузка на отрисовку при больших файлах, сложнее поддержка. Не подходит под требование минимального влияния.

➡ Выбор: вариант 1 (TextMate + `editor.tokenColorCustomizations`).

## Дизайн настроек: ключи по реальным токенам
Вводим ключи настроек, соответствующие реальным токенам подсветки. Все значения — цвета в формате `#RRGGBB` или `#RRGGBBAA`.
- `hledger.theme.enabled` (boolean) — включает применение цветов.
- `hledger.theme.date`
- `hledger.theme.time`
- `hledger.theme.amount`
- `hledger.theme.account`
- `hledger.theme.accountVirtual`
- `hledger.theme.commodity`
- `hledger.theme.payee`
- `hledger.theme.note`
- `hledger.theme.comment`
- `hledger.theme.tag`
- `hledger.theme.directive`
- `hledger.theme.operator`
- `hledger.theme.code`
- `hledger.theme.link`

### Дефолтные значения (подобраны из текущих правил)
- date: `#2563EB`
- time: `#2563EB` (можно отличить при желании)
- amount: `#F59E0B`
- account: `#0EA5E9`
- accountVirtual: `#6B7280`
- commodity: `#A855F7`
- payee: `#EF4444`
- note: `#6B7280`
- comment: `#9CA3AF`
- tag: `#EC4899`
- directive: `#0EA5E9`
- operator: `#EAB308`
- code: `#A855F7`
- link: `#2563EB`

## Отображение (имя токена) → scopes (внутренняя таблица)
- date → `constant.numeric.date.hledger`
- time → `constant.numeric.time.hledger`
- amount → `constant.numeric.amount.hledger`
- account →
  - `entity.name.type.account.hledger`
  - `entity.name.type.account.assets.hledger`
  - `entity.name.type.account.expenses.hledger`
  - `entity.name.type.account.liabilities.hledger`
  - `entity.name.type.account.equity.hledger`
  - `entity.name.type.account.income.hledger`
- accountVirtual → `variable.other.account.virtual.hledger`
- commodity → `entity.name.type.commodity.hledger`
- payee → `entity.name.function.payee.hledger`
- note → `string.unquoted.note.hledger`
- comment → `comment.line.semicolon.hledger`, `comment.line.number-sign.hledger`, `comment.block.hledger`
- tag → `entity.name.tag.hledger`
- directive → `keyword.directive.hledger`, `keyword.directive.csv.hledger`
- operator → `keyword.operator.status.hledger`, `keyword.operator.balance-assertion.hledger`, `keyword.operator.price-assignment.hledger`, `keyword.operator.cost.hledger`, `keyword.operator.cost.total.hledger`, `keyword.operator.assertion.hledger`, `keyword.operator.auto.hledger`, `keyword.operator.periodic.hledger`, `keyword.operator.timeclock.hledger`
- code → `string.other.code.hledger`
- link → `markup.underline.link.hledger`

Замечания:
- Для совместимости лучше покрыть все `account.*` подтипы, даже если ранее явно не настраивались.

## Алгоритм применения палитры
1) При старте и при изменении настроек `hledger.theme.*`:
   - Прочитать текущие значения токенных ключей и `enabled`.
   - Сформировать массив `textMateRules` на основе таблицы соответствий.
2) Аккуратно слить с существующими `editor.tokenColorCustomizations` пользователя:
   - Прочитать существующее значение `editor.tokenColorCustomizations`.
   - Удалить только предыдущие правила, добавленные расширением (идентифицировать по `name` с префиксом `hledger@` или по `scope`, содержащему `.hledger`).
   - Добавить новые правила.
3) Вызвать `update('editor.tokenColorCustomizations', mergedValue, ConfigurationTarget.Workspace)` (или `Global`, если нет рабочей папки).
4) Если `enabled=false` — удалить только наши `.hledger`-правила и оставить пользовательские без изменений.
5) Ничего не делать, если вычисленные правила идентичны уже установленным (избежать лишних перезаписей/мигания темы).

### Пример генерируемого правила
```json
{
  "name": "hledger@date",
  "scope": ["constant.numeric.date.hledger"],
  "settings": { "foreground": "#2563EB" }
}
```

### Набросок кода применения (идея)
```ts
import * as vscode from 'vscode';

function buildRulesFromTokenColors(colors: Record<string, string>, enabled: boolean) {
  if (!enabled) return [];
  const map: Array<{ name: string; scope: string | string[]; key: string }> = [
    { name: 'hledger@date', scope: 'constant.numeric.date.hledger', key: 'date' },
    { name: 'hledger@time', scope: 'constant.numeric.time.hledger', key: 'time' },
    { name: 'hledger@amount', scope: 'constant.numeric.amount.hledger', key: 'amount' },
    { name: 'hledger@account', scope: [
      'entity.name.type.account.hledger',
      'entity.name.type.account.assets.hledger',
      'entity.name.type.account.expenses.hledger',
      'entity.name.type.account.liabilities.hledger',
      'entity.name.type.account.equity.hledger',
      'entity.name.type.account.income.hledger'
    ], key: 'account' },
    { name: 'hledger@accountVirtual', scope: 'variable.other.account.virtual.hledger', key: 'accountVirtual' },
    { name: 'hledger@commodity', scope: 'entity.name.type.commodity.hledger', key: 'commodity' },
    { name: 'hledger@payee', scope: 'entity.name.function.payee.hledger', key: 'payee' },
    { name: 'hledger@note', scope: 'string.unquoted.note.hledger', key: 'note' },
    { name: 'hledger@comment', scope: [
      'comment.line.semicolon.hledger',
      'comment.line.number-sign.hledger',
      'comment.block.hledger'
    ], key: 'comment' },
    { name: 'hledger@tag', scope: 'entity.name.tag.hledger', key: 'tag' },
    { name: 'hledger@directive', scope: [
      'keyword.directive.hledger',
      'keyword.directive.csv.hledger'
    ], key: 'directive' },
    { name: 'hledger@operator', scope: [
      'keyword.operator.status.hledger',
      'keyword.operator.balance-assertion.hledger',
      'keyword.operator.price-assignment.hledger',
      'keyword.operator.cost.hledger',
      'keyword.operator.cost.total.hledger',
      'keyword.operator.assertion.hledger',
      'keyword.operator.auto.hledger',
      'keyword.operator.periodic.hledger',
      'keyword.operator.timeclock.hledger'
    ], key: 'operator' },
    { name: 'hledger@code', scope: 'string.other.code.hledger', key: 'code' },
    { name: 'hledger@link', scope: 'markup.underline.link.hledger', key: 'link' }
  ];
  return map.map(({ name, scope, key }) => ({ name, scope, settings: { foreground: colors[key] } }));
}

async function applyThemeFromSettings() {
  const cfg = vscode.workspace.getConfiguration();
  const enabled = cfg.get<boolean>('hledger.theme.enabled', true);
  const get = (k: string) => cfg.get<string>(`hledger.theme.${k}`, '');
  const colors = {
    date: get('date'),
    time: get('time'),
    amount: get('amount'),
    account: get('account'),
    accountVirtual: get('accountVirtual'),
    commodity: get('commodity'),
    payee: get('payee'),
    note: get('note'),
    comment: get('comment'),
    tag: get('tag'),
    directive: get('directive'),
    operator: get('operator'),
    code: get('code'),
    link: get('link')
  } as const;

  const rules = buildRulesFromTokenColors(colors as any, enabled);

  const current = cfg.get<any>('editor.tokenColorCustomizations') ?? {};
  const existingRules: any[] = current.textMateRules ?? [];
  const kept = existingRules.filter(r => !(typeof r.name === 'string' && r.name.startsWith('hledger@')));
  const next = { ...current, textMateRules: [...kept, ...rules] };

  if (JSON.stringify(current) !== JSON.stringify(next)) {
    await cfg.update('editor.tokenColorCustomizations', next, vscode.ConfigurationTarget.Workspace);
  }
}
```

## Производительность
- Генерация и применение `textMateRules` происходит только при изменении конфигурации/старте.
- Рендеринг выполняется движком VS Code на уровне темы — это максимально быстрый путь (без декораций и обходов текста).
- Количество правил ограничено (≈10–13), что практически не влияет на производительность.

## План работ
1) Конфигурация
   - Добавить в `package.json` ключи: `hledger.theme.enabled` и `hledger.theme.*` (перечень из раздела «Дизайн настроек») с дефолтами из текущих цветов.
2) Код
   - Создать `ThemeManager` (или утилиту) для построения и применения `textMateRules` из `hledger.theme.*`.
   - Подписаться на `onDidChangeConfiguration` по префиксу `hledger.theme.` и вызывать применение.
   - Реализовать merge-логику с существующим `editor.tokenColorCustomizations` (удалять только правила, начинающиеся с `name: hledger@`).
3) Миграция дефолтов
   - Удалить статические `textMateRules` из `configurationDefaults` в `package.json`, чтобы источником правды стала токенная схема.
   - Сохранить прежние цвета как дефолты для `hledger.theme.*`.
   - Выровнять `markup.underline.link.url.hledger` → `markup.underline.link.hledger` везде, где необходимо.
4) Тестирование
   - Проверить в светлой/темной темах VS Code, в пустой/заполненной конфигурации пользователя.
   - Проверить, что отключение (`enabled=false`) корректно убирает только наши правила.
5) Документация
   - Обновить README с разделом «Настройка цветов hledger по токенам» (примеры `settings.json`).

## Риски и совместимость
- Пользовательские `editor.tokenColorCustomizations` уже могут содержать правила для `.hledger`. Наша merge‑логика должна заменять только правила, помеченные `name: hledger@…` либо явным списком наших `scope`.
- Глобальные обновления `editor.tokenColorCustomizations` могут затронуть другие проекты. Предпочтительно писать в `Workspace`, если открыта папка.
- При установке дефолтов через палитру важно придерживаться стабильного набора `accentXX`, чтобы не ломать пользовательские настройки.

## Пример настройки пользователем
```jsonc
{
  // Включить настраиваемую палитру hledger по токенам
  "hledger.theme.enabled": true,

  // Цвета по реальным токенам
  "hledger.theme.date": "#34D399",
  "hledger.theme.time": "#60A5FA",
  "hledger.theme.amount": "#FBBF24",
  "hledger.theme.account": "#38BDF8",
  "hledger.theme.accountVirtual": "#6B7280",
  "hledger.theme.commodity": "#C084FC",
  "hledger.theme.payee": "#F87171",
  "hledger.theme.note": "#6B7280",
  "hledger.theme.comment": "#9CA3AF",
  "hledger.theme.tag": "#F472B6",
  "hledger.theme.directive": "#38BDF8",
  "hledger.theme.operator": "#FACC15",
  "hledger.theme.code": "#C084FC",
  "hledger.theme.link": "#2563EB"
}
```

## Итог
- Используем TextMate‑темизацию через `editor.tokenColorCustomizations`, генерируя правила из настроек `hledger.theme.*`.
- В настройках используются реальные названия токенов; соответствие (имя токена) → scopes зашито в расширение.
- Перфоманс не страдает: никакой пост‑обработки текста и декораций, только конфигурация темы.
