import * as vscode from 'vscode';
import { LSPStatusBar } from '../LSPStatusBar';
import { LSPStatus } from '../LSPManager';

describe('LSPStatusBar', () => {
  let statusBar: LSPStatusBar;
  let mockItem: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockItem = (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue({
      text: '',
      tooltip: '',
      command: undefined as string | undefined,
      color: undefined as string | undefined,
      backgroundColor: undefined as any,
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })();
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockItem);
    statusBar = new LSPStatusBar();
  });

  afterEach(() => {
    statusBar.dispose();
  });

  it('should create status bar item with right alignment', () => {
    expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
      vscode.StatusBarAlignment.Right,
      100
    );
  });

  it('should set click command to hledger.lsp.restart', () => {
    expect(mockItem.command).toBe('hledger.lsp.restart');
  });

  it('should show item on creation', () => {
    expect(mockItem.show).toHaveBeenCalled();
  });

  describe('update', () => {
    it('should show running state', () => {
      statusBar.update(LSPStatus.Running);

      expect(mockItem.text).toBe('$(server) HLedger LSP');
      expect(mockItem.tooltip).toBe('HLedger Language Server: Running');
    });

    it('should show starting state with sync icon', () => {
      statusBar.update(LSPStatus.Starting);

      expect(mockItem.text).toBe('$(sync~spin) HLedger LSP');
      expect(mockItem.tooltip).toBe('HLedger Language Server: Starting...');
    });

    it('should show error state with warning icon', () => {
      statusBar.update(LSPStatus.Error);

      expect(mockItem.text).toBe('$(warning) HLedger LSP');
      expect(mockItem.tooltip).toBe('HLedger Language Server: Error (click to restart)');
    });

    it('should show not installed state with cloud-download icon', () => {
      statusBar.update(LSPStatus.NotInstalled);

      expect(mockItem.text).toBe('$(cloud-download) HLedger LSP');
      expect(mockItem.tooltip).toBe('HLedger Language Server: Not Installed');
    });

    it('should show stopped state with debug-stop icon', () => {
      statusBar.update(LSPStatus.Stopped);

      expect(mockItem.text).toBe('$(debug-stop) HLedger LSP');
      expect(mockItem.tooltip).toBe('HLedger Language Server: Stopped');
    });

    it('should show downloading state with sync icon', () => {
      statusBar.update(LSPStatus.Downloading);

      expect(mockItem.text).toBe('$(sync~spin) HLedger LSP');
      expect(mockItem.tooltip).toBe('HLedger Language Server: Downloading...');
    });
  });

  describe('dispose', () => {
    it('should dispose the status bar item', () => {
      statusBar.dispose();

      expect(mockItem.dispose).toHaveBeenCalled();
    });
  });
});
