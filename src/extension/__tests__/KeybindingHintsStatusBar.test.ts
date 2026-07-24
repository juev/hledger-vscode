import * as vscode from 'vscode';
import { KeybindingHintsStatusBar } from '../KeybindingHintsStatusBar';

describe('KeybindingHintsStatusBar', () => {
  let statusBar: KeybindingHintsStatusBar;
  let mockItem: any;
  let editorChangeCallback: ((editor: any) => void) | undefined;
  let configurationChangeCallback:
    | ((event: vscode.ConfigurationChangeEvent) => void)
    | undefined;
  let transactionStatusKeybindingsEnabled: boolean;

  beforeEach(() => {
    jest.clearAllMocks();
    editorChangeCallback = undefined;
    configurationChangeCallback = undefined;
    transactionStatusKeybindingsEnabled = false;

    (vscode.window as any).activeTextEditor = undefined;

    mockItem = {
      text: '',
      tooltip: '',
      name: undefined as string | undefined,
      command: undefined as string | undefined,
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    };
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockItem);
    (vscode.window.onDidChangeActiveTextEditor as jest.Mock).mockImplementation(
      (callback: (editor: any) => void) => {
        editorChangeCallback = callback;
        return { dispose: jest.fn() };
      }
    );
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'keybindings.transactionStatus') {
          return transactionStatusKeybindingsEnabled;
        }
        return defaultValue;
      }),
    });
    (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockImplementation(
      (callback: (event: vscode.ConfigurationChangeEvent) => void) => {
        configurationChangeCallback = callback;
        return { dispose: jest.fn() };
      }
    );
  });

  afterEach(() => {
    statusBar?.dispose();
  });

  describe('construction', () => {
    it('should create status bar item with right alignment and priority 99', () => {
      statusBar = new KeybindingHintsStatusBar();

      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Right,
        99
      );
    });

    it('should not advertise disabled status keybindings', () => {
      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.text).not.toContain('status');
      expect(mockItem.text).not.toContain('⌘K S');
      expect(mockItem.text).toContain('align');
      expect(mockItem.text).toContain('suggest');
    });

    it('should advertise status keybindings when enabled', () => {
      transactionStatusKeybindingsEnabled = true;
      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.text).toContain('⌘K S');
      expect(mockItem.text).toContain('status');
      expect(mockItem.tooltip).toContain('Cmd+K S');
    });

    it('should set tooltip', () => {
      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.tooltip).not.toContain('Cmd+K S');
      expect(mockItem.tooltip).toContain('Tab');
      expect(mockItem.tooltip).toContain('Enter');
    });

    it('should set name', () => {
      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.name).toBe('HLedger Keybinding Hints');
    });

    it('should register editor change listener', () => {
      statusBar = new KeybindingHintsStatusBar();

      expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
      expect(editorChangeCallback).toBeDefined();
    });

    it('should update status keybinding hints after configuration changes', () => {
      statusBar = new KeybindingHintsStatusBar();

      transactionStatusKeybindingsEnabled = true;
      configurationChangeCallback!({
        affectsConfiguration: (section: string) =>
          section === 'hledger.keybindings.transactionStatus',
      });

      expect(mockItem.text).toContain('⌘K S');
      expect(mockItem.tooltip).toContain('Cmd+K S');
    });
  });

  describe('visibility', () => {
    it('should show when active editor is hledger file', () => {
      (vscode.window as any).activeTextEditor = {
        document: { languageId: 'hledger' },
      };

      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.show).toHaveBeenCalled();
    });

    it('should hide when active editor is not hledger file', () => {
      (vscode.window as any).activeTextEditor = {
        document: { languageId: 'typescript' },
      };

      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.hide).toHaveBeenCalled();
    });

    it('should hide when no active editor', () => {
      (vscode.window as any).activeTextEditor = undefined;

      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.hide).toHaveBeenCalled();
    });

    it('should update visibility on editor change', () => {
      (vscode.window as any).activeTextEditor = undefined;
      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.hide).toHaveBeenCalled();

      editorChangeCallback!({
        document: { languageId: 'hledger' },
      });

      expect(mockItem.show).toHaveBeenCalled();
    });

    it('should hide when switching away from hledger file', () => {
      (vscode.window as any).activeTextEditor = {
        document: { languageId: 'hledger' },
      };
      statusBar = new KeybindingHintsStatusBar();

      expect(mockItem.show).toHaveBeenCalled();

      editorChangeCallback!({
        document: { languageId: 'markdown' },
      });

      expect(mockItem.hide).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose status bar item and listeners', () => {
      statusBar = new KeybindingHintsStatusBar();
      statusBar.dispose();

      expect(mockItem.dispose).toHaveBeenCalled();
    });
  });
});
