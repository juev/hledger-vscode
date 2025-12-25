import * as vscode from 'vscode';
import { HLedgerCodeActionProvider } from '../HLedgerCodeActionProvider';
import { HLedgerConfig } from '../../HLedgerConfig';

describe('HLedgerCodeActionProvider', () => {
  let provider: HLedgerCodeActionProvider;
  let mockConfig: HLedgerConfig;
  let mockDocument: vscode.TextDocument;

  beforeEach(() => {
    mockConfig = {} as HLedgerConfig;
    provider = new HLedgerCodeActionProvider(mockConfig);

    mockDocument = {
      uri: vscode.Uri.file('/test/test.journal'),
      fileName: '/test/test.journal',
      languageId: 'hledger',
      getText: jest.fn(),
      lineAt: jest.fn(),
    } as unknown as vscode.TextDocument;
  });

  describe('Balance Assertion', () => {
    test('offers balance assertion for posting with commodity prefix', () => {
      const lineText = '    Assets:Checking  $100.00';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 5, 0, 5);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      expect(actions?.length).toBe(1);
      expect(actions?.[0]?.title).toBe('Add balance assertion');
      expect(actions?.[0]?.kind).toEqual(vscode.CodeActionKind.Refactor);
    });

    test('inserts balance assertion at end of line with correct format', () => {
      const lineText = '    Assets:Checking  $100.00';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(1, 0, 1, lineText.length),
      });

      const range = new vscode.Range(1, 10, 1, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      const action = actions?.[0];
      expect(action?.edit).toBeDefined();

      const edit = action?.edit?.get(mockDocument.uri)?.[0];
      expect(edit).toBeDefined();
      expect(edit?.newText).toBe(' = $100.00');
      expect(edit?.range.start.line).toBe(1);
      expect(edit?.range.start.character).toBe(lineText.length);
    });

    test('does not offer action if assertion already exists', () => {
      const lineText = '    Assets:Checking  $100.00 = $1000.00';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeUndefined();
    });

    test('does not offer action for non-posting lines', () => {
      const lineText = '2024-01-15 Opening balance';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 5, 0, 5);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeUndefined();
    });

    test('handles commodity suffix format', () => {
      const lineText = '    Assets:Checking  100.00 USD';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      const action = actions?.[0];
      const edit = action?.edit?.get(mockDocument.uri)?.[0];
      expect(edit?.newText).toBe(' = 100.00 USD');
    });

    test('handles no commodity format', () => {
      const lineText = '    Expenses:Groceries  5';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      const action = actions?.[0];
      const edit = action?.edit?.get(mockDocument.uri)?.[0];
      expect(edit?.newText).toBe(' = 5');
    });

    test('handles negative amounts', () => {
      const lineText = '    Liabilities:CreditCard  $-50.00';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      const action = actions?.[0];
      const edit = action?.edit?.get(mockDocument.uri)?.[0];
      expect(edit?.newText).toBe(' = $-50.00');
    });

    test('handles Unicode account names (Cyrillic)', () => {
      const lineText = '    Активы:Расчётный  1000.00 RUB';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      expect(actions?.length).toBe(1);
    });

    test('handles amounts with commas', () => {
      const lineText = '    Assets:Savings  $1,000.00';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      const action = actions?.[0];
      const edit = action?.edit?.get(mockDocument.uri)?.[0];
      expect(edit?.newText).toBe(' = $1,000.00');
    });

    test('does not offer action for lines without amount', () => {
      const lineText = '    Assets:Checking';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeUndefined();
    });

    test('does not offer action for comment lines', () => {
      const lineText = '    ; Some comment';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeUndefined();
    });

    test('handles spaces in account names', () => {
      const lineText = '    Assets:My Bank Account  $500.00';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 10, 0, 10);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeDefined();
      const action = actions?.[0];
      const edit = action?.edit?.get(mockDocument.uri)?.[0];
      expect(edit?.newText).toBe(' = $500.00');
    });
  });

  describe('CodeActionProvider interface', () => {
    test('providedCodeActionKinds includes Refactor and QuickFix', () => {
      expect(HLedgerCodeActionProvider.providedCodeActionKinds).toContain(
        vscode.CodeActionKind.Refactor
      );
      expect(HLedgerCodeActionProvider.providedCodeActionKinds).toContain(
        vscode.CodeActionKind.QuickFix
      );
    });

    test('returns undefined when no actions available', () => {
      const lineText = 'Not a posting line';
      (mockDocument.lineAt as jest.Mock).mockReturnValue({
        text: lineText,
        range: new vscode.Range(0, 0, 0, lineText.length),
      });

      const range = new vscode.Range(0, 0, 0, 0);
      const context: vscode.CodeActionContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument,
        range,
        context,
        {} as vscode.CancellationToken
      );

      expect(actions).toBeUndefined();
    });
  });
});
