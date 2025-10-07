import * as vscode from 'vscode';

export type HledgerThemeColors = {
  date?: string;
  time?: string;
  amount?: string;
  account?: string;
  accountVirtual?: string;
  commodity?: string;
  payee?: string;
  note?: string;
  comment?: string;
  tag?: string;
  directive?: string;
  operator?: string;
  code?: string;
  link?: string;
};

/**
 * Builds TextMate rules for hledger scopes based on configured token colors.
 */
export function buildHledgerTextMateRules(colors: HledgerThemeColors, enabled: boolean): any[] {
  if (!enabled) return [];

  const entries: Array<{ name: string; scope: string | string[]; key: keyof HledgerThemeColors }> = [
    { name: 'hledger@date', scope: 'constant.numeric.date.hledger', key: 'date' },
    { name: 'hledger@time', scope: 'constant.numeric.time.hledger', key: 'time' },
    { name: 'hledger@amount', scope: 'constant.numeric.amount.hledger', key: 'amount' },
    {
      name: 'hledger@account',
      scope: [
        'entity.name.type.account.hledger',
        'entity.name.type.account.assets.hledger',
        'entity.name.type.account.expenses.hledger',
        'entity.name.type.account.liabilities.hledger',
        'entity.name.type.account.equity.hledger',
        'entity.name.type.account.income.hledger',
      ],
      key: 'account',
    },
    { name: 'hledger@accountVirtual', scope: 'variable.other.account.virtual.hledger', key: 'accountVirtual' },
    { name: 'hledger@commodity', scope: 'entity.name.type.commodity.hledger', key: 'commodity' },
    { name: 'hledger@payee', scope: 'entity.name.function.payee.hledger', key: 'payee' },
    { name: 'hledger@note', scope: 'string.unquoted.note.hledger', key: 'note' },
    {
      name: 'hledger@comment',
      scope: ['comment.line.semicolon.hledger', 'comment.line.number-sign.hledger', 'comment.block.hledger'],
      key: 'comment',
    },
    { name: 'hledger@tag', scope: 'entity.name.tag.hledger', key: 'tag' },
    { name: 'hledger@directive', scope: ['keyword.directive.hledger', 'keyword.directive.csv.hledger'], key: 'directive' },
    {
      name: 'hledger@operator',
      scope: [
        'keyword.operator.status.hledger',
        'keyword.operator.balance-assertion.hledger',
        'keyword.operator.price-assignment.hledger',
        'keyword.operator.cost.hledger',
        'keyword.operator.cost.total.hledger',
        'keyword.operator.assertion.hledger',
        'keyword.operator.auto.hledger',
        'keyword.operator.periodic.hledger',
        'keyword.operator.timeclock.hledger',
      ],
      key: 'operator',
    },
    { name: 'hledger@code', scope: 'string.other.code.hledger', key: 'code' },
    { name: 'hledger@link', scope: 'markup.underline.link.hledger', key: 'link' },
  ];

  const rules: any[] = [];
  for (const { name, scope, key } of entries) {
    const color = colors[key];
    if (!color || color.trim() === '') continue;
    rules.push({ name, scope, settings: { foreground: color } });
  }
  return rules;
}

export class ThemeManager {
  static async applyFromConfiguration(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration();
    const enabled = cfg.get<boolean>('hledger.theme.enabled', true);

    const get = (k: string) => cfg.get<string>(`hledger.theme.${k}`, '');
    const colors: HledgerThemeColors = {
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
      link: get('link'),
    };

    const currentValue = cfg.get<any>('editor.tokenColorCustomizations') ?? {};
    const currentObj = typeof currentValue === 'object' && currentValue !== null ? currentValue : {};
    const existingRules: any[] = Array.isArray(currentObj.textMateRules) ? currentObj.textMateRules : [];
    const kept = existingRules.filter((r) => !(typeof r?.name === 'string' && r.name.startsWith('hledger@')));

    const rules = buildHledgerTextMateRules(colors, enabled);
    const next = { ...currentObj, textMateRules: [...kept, ...rules] };

    if (JSON.stringify(currentObj) === JSON.stringify(next)) {
      return; // No changes needed
    }

    // Prefer workspace target when a folder is open; otherwise fall back to global
    const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    const target = hasWorkspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    await cfg.update('editor.tokenColorCustomizations', next, target);
  }
}
