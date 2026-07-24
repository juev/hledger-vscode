import * as fs from 'fs';
import * as path from 'path';

interface KeybindingContribution {
  command: string;
  when?: string;
}

interface ConfigurationProperty {
  default?: unknown;
}

interface ExtensionManifest {
  contributes?: {
    configuration?: {
      properties?: Record<string, ConfigurationProperty>;
    };
    keybindings?: KeybindingContribution[];
  };
}

describe('keybinding contributions', () => {
  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8')
  ) as ExtensionManifest;

  it('keeps transaction status keybindings disabled by default', () => {
    const setting =
      pkg.contributes?.configuration?.properties?.[
        'hledger.keybindings.transactionStatus'
      ];

    expect(setting?.default).toBe(false);
  });

  it('guards every transaction status keybinding with the opt-in setting', () => {
    const statusCommands = new Set([
      'hledger.editor.cycleStatus',
      'hledger.editor.setStatusUnmarked',
      'hledger.editor.setStatusPending',
      'hledger.editor.setStatusCleared',
    ]);
    const statusKeybindings = (pkg.contributes?.keybindings ?? []).filter(
      ({ command }) => statusCommands.has(command)
    );

    expect(statusKeybindings).toHaveLength(statusCommands.size);
    for (const keybinding of statusKeybindings) {
      expect(keybinding.when).toContain(
        'config.hledger.keybindings.transactionStatus'
      );
    }
  });
});
