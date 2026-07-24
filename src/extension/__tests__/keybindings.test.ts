import * as fs from 'fs';
import * as path from 'path';

interface KeybindingContribution {
  command: string;
  key?: string;
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

  const getKeybinding = (command: string): KeybindingContribution | undefined =>
    pkg.contributes?.keybindings?.find(
      (keybinding) => keybinding.command === command
    );

  it('keeps Enter and Tab overrides enabled by default', () => {
    const properties = pkg.contributes?.configuration?.properties;

    expect(properties?.['hledger.keybindings.enterAndSuggest']?.default).toBe(
      true
    );
    expect(properties?.['hledger.keybindings.alignAmount']?.default).toBe(true);
  });

  it('claims Enter and Tab for hledger when inline suggestions are visible', () => {
    const enterKeybinding = getKeybinding('hledger.editor.enterAndSuggest');
    const tabKeybinding = getKeybinding('hledger.editor.alignAmount');

    expect(enterKeybinding?.key).toBe('enter');
    expect(enterKeybinding?.when).toContain('editorLangId == hledger');
    expect(enterKeybinding?.when).not.toContain('!inlineSuggestionVisible');

    expect(tabKeybinding?.key).toBe('tab');
    expect(tabKeybinding?.when).toContain('editorLangId == hledger');
    expect(tabKeybinding?.when).not.toContain('!inlineSuggestionVisible');
  });

  it('keeps transaction status keybindings active in hledger editors', () => {
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
      expect(keybinding.when).toContain('editorLangId == hledger');
      expect(keybinding.when).not.toContain(
        'config.hledger.keybindings.transactionStatus'
      );
    }

    expect(
      pkg.contributes?.configuration?.properties?.[
        'hledger.keybindings.transactionStatus'
      ]
    ).toBeUndefined();
  });
});
