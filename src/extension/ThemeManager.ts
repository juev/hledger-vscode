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
  /** Keys used under hledger.theme */
  private static readonly THEME_SETTING_KEYS: readonly string[] = [
    'enabled',
    'date',
    'time',
    'amount',
    'account',
    'accountVirtual',
    'commodity',
    'payee',
    'note',
    'comment',
    'tag',
    'directive',
    'operator',
    'code',
    'link',
  ] as const;

  /**
   * Apply token color rules based on current settings, updating only the scope that changed
   * (workspace folder, workspace, or global). If no event is provided, applies in priority order:
   * per-folder (if explicitly configured) -> workspace (if configured) -> global (if configured) -> fallback.
   */
  static async applyFromConfiguration(event?: vscode.ConfigurationChangeEvent): Promise<void> {
    const targets = this.resolveTargets(event);
    for (const spec of targets) {
      await this.applyToTarget(spec);
    }
  }

  private static resolveTargets(event?: vscode.ConfigurationChangeEvent): Array<{ target: vscode.ConfigurationTarget; folder?: vscode.WorkspaceFolder }> {
    const results: Array<{ target: vscode.ConfigurationTarget; folder?: vscode.WorkspaceFolder }> = [];

    const folders = vscode.workspace.workspaceFolders ?? [];

    // 1) If event specifies folder-scoped changes, handle those explicitly
    if (event) {
      for (const folder of folders) {
        if (event.affectsConfiguration('hledger.theme', folder)) {
          results.push({ target: vscode.ConfigurationTarget.WorkspaceFolder, folder });
        }
      }
      // 2) Top-level change (workspace or global)
      if (event.affectsConfiguration('hledger.theme')) {
        const rootCfg = vscode.workspace.getConfiguration();
        const hasWorkspace = this.hasAnyScopeValue(rootCfg, vscode.ConfigurationTarget.Workspace);
        const hasGlobal = this.hasAnyScopeValue(rootCfg, vscode.ConfigurationTarget.Global);
        if (hasWorkspace) {
          results.push({ target: vscode.ConfigurationTarget.Workspace });
        }
        if (hasGlobal) {
          results.push({ target: vscode.ConfigurationTarget.Global });
        }
        if (!hasWorkspace && !hasGlobal) {
          // Fallback if cannot infer: prefer workspace when folders open, else global
          const fallbackTarget = folders.length > 0 ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
          results.push({ target: fallbackTarget });
        }
      }
      if (results.length > 0) {
        return results;
      }
    }

    // 3) No event: choose scopes with explicit settings
    for (const folder of folders) {
      const cfgFolder = vscode.workspace.getConfiguration(undefined, folder.uri);
      if (this.hasAnyScopeValue(cfgFolder, vscode.ConfigurationTarget.WorkspaceFolder)) {
        results.push({ target: vscode.ConfigurationTarget.WorkspaceFolder, folder });
      }
    }

    const rootCfg = vscode.workspace.getConfiguration();
    if (this.hasAnyScopeValue(rootCfg, vscode.ConfigurationTarget.Workspace)) {
      results.push({ target: vscode.ConfigurationTarget.Workspace });
    }
    if (this.hasAnyScopeValue(rootCfg, vscode.ConfigurationTarget.Global)) {
      results.push({ target: vscode.ConfigurationTarget.Global });
    }

    if (results.length === 0) {
      // Final fallback: keep previous behavior
      const fallbackTarget = folders.length > 0 ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
      results.push({ target: fallbackTarget });
    }

    return results;
  }

  private static hasAnyScopeValue(cfg: vscode.WorkspaceConfiguration, target: vscode.ConfigurationTarget): boolean {
    for (const key of this.THEME_SETTING_KEYS) {
      const inspected = cfg.inspect<any>(`hledger.theme.${key}`);
      if (!inspected) continue;
      const scoped = this.pickScopedValue(inspected, target);
      if (scoped !== undefined) return true;
    }
    return false;
  }

  private static pickScopedValue<T>(inspected: any, target: vscode.ConfigurationTarget): T | undefined {
    switch (target) {
      case vscode.ConfigurationTarget.Global:
        return inspected.globalValue as T | undefined;
      case vscode.ConfigurationTarget.Workspace:
        return inspected.workspaceValue as T | undefined;
      case vscode.ConfigurationTarget.WorkspaceFolder:
        // When cfg is created with folder scope, this field will be the folder override
        return (inspected as any).workspaceFolderValue as T | undefined;
    }
  }

  private static readColorsAndEnabled(cfg: vscode.WorkspaceConfiguration): { colors: HledgerThemeColors; enabled: boolean } {
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
    return { colors, enabled };
  }

  private static getScopedEditorTokenColors(cfg: vscode.WorkspaceConfiguration, target: vscode.ConfigurationTarget): any {
    const inspected = cfg.inspect<any>('editor.tokenColorCustomizations');
    if (!inspected) return {};
    const value = this.pickScopedValue(inspected, target);
    const obj = typeof value === 'object' && value !== null ? (value as any) : {};
    return obj;
  }

  private static async applyToTarget(spec: { target: vscode.ConfigurationTarget; folder?: vscode.WorkspaceFolder }): Promise<void> {
    const cfg = spec.folder
      ? vscode.workspace.getConfiguration(undefined, spec.folder.uri)
      : vscode.workspace.getConfiguration();

    const { colors, enabled } = this.readColorsAndEnabled(cfg);

    const currentObj = this.getScopedEditorTokenColors(cfg, spec.target);
    const existingRules: any[] = Array.isArray(currentObj.textMateRules) ? currentObj.textMateRules : [];
    const kept = existingRules.filter((r) => !(typeof r?.name === 'string' && r.name.startsWith('hledger@')));

    const rules = buildHledgerTextMateRules(colors, enabled);
    const next = { ...currentObj, textMateRules: [...kept, ...rules] };

    if (JSON.stringify(currentObj) === JSON.stringify(next)) {
      return; // No changes needed
    }

    await cfg.update('editor.tokenColorCustomizations', next, spec.target);
  }
}
