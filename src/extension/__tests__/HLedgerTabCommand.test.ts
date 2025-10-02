import * as vscode from 'vscode';
import { HLedgerTabCommand } from '../HLedgerTabCommand';
import { TransactionBlock, PostingLine } from '../DocumentFormatter';
import { failure } from '../types';

// Mock VS Code API
jest.mock('vscode', () => ({
    commands: {
        registerTextEditorCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        executeCommand: jest.fn()
    },
    window: {
        activeTextEditor: {
            document: {},
            selection: {
                active: {}
            }
        },
        setStatusBarMessage: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnValue(true)
        })
    },
    Position: jest.fn().mockImplementation((line, character) => ({ line, character })),
    Selection: jest.fn().mockImplementation((anchor, active) => ({ anchor, active })),
    TextEditor: jest.fn()
}));

describe('HLedgerTabCommand', () => {
    let tabCommand: HLedgerTabCommand;
    let mockTextEditor: any;
    let mockDocument: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDocument = {
            languageId: 'hledger',
            lineAt: jest.fn(),
            getText: jest.fn()
        };

        mockTextEditor = {
            document: mockDocument,
            selection: {
                active: { line: 0, character: 0 }
            }
        };

        tabCommand = new HLedgerTabCommand();
    });

    afterEach(() => {
        if (tabCommand) {
            tabCommand.dispose();
        }
    });

    describe('onTab', () => {
        it('should execute standard tab for non-hledger files', async () => {
            mockDocument.languageId = 'javascript';

            await tabCommand['onTab'](mockTextEditor, {} as any);

            expect((vscode.commands as any).executeCommand).toHaveBeenCalledWith('default:type', { text: '\t' });
        });

        it('should analyze context for hledger files', async () => {
            mockDocument.lineAt.mockReturnValue({
                text: '    Expenses:Food  ',
                lineNumber: 1
            });

            const analyzeTabContextSpy = jest.spyOn(tabCommand as any, 'analyzeTabContext');

            await tabCommand['onTab'](mockTextEditor, {} as any);

            expect(analyzeTabContextSpy).toHaveBeenCalled();
        });
    });

    describe('analyzeTabContext', () => {
        it('should detect amount positioning context after account name with spacing', () => {
            mockDocument.lineAt.mockReturnValue({
                text: '    Expenses:Food  ',
                lineNumber: 1
            });

            const position = new vscode.Position(0, 20);
            const result = tabCommand['analyzeTabContext'](mockDocument, position);

            expect(result.shouldAlign).toBe(true);
            expect(result.type).toBe('move_to_amount_position');
        });

        it('should detect context right after account name', () => {
            mockDocument.lineAt.mockReturnValue({
                text: '    Expenses:Food',
                lineNumber: 1
            });

            const position = new vscode.Position(0, 18);
            const result = tabCommand['analyzeTabContext'](mockDocument, position);

            expect(result.shouldAlign).toBe(true);
            expect(result.type).toBe('move_to_amount_position');
        });

        it('should detect context right after simple account name', () => {
            mockDocument.lineAt.mockReturnValue({
                text: '    Assets:Cash',
                lineNumber: 1
            });

            const position = new vscode.Position(0, 15);
            const result = tabCommand['analyzeTabContext'](mockDocument, position);

            expect(result.shouldAlign).toBe(true);
            expect(result.type).toBe('move_to_amount_position');
        });

        it('should not align for non-posting lines', () => {
            mockDocument.lineAt.mockReturnValue({
                text: '2024/01/01 * Transaction',
                lineNumber: 1
            });

            const position = new vscode.Position(0, 10);
            const result = tabCommand['analyzeTabContext'](mockDocument, position);

            expect(result.shouldAlign).toBe(false);
        });

        it('should handle partial amount entry', () => {
            mockDocument.lineAt.mockReturnValue({
                text: '    Expenses:Food  1',
                lineNumber: 1
            });

            const position = new vscode.Position(0, 21);
            const result = tabCommand['analyzeTabContext'](mockDocument, position);

            expect(result.shouldAlign).toBe(true);
            expect(result.type).toBe('move_to_amount_position');
        });

        it('should detect context with single space after account name', () => {
            mockDocument.lineAt.mockReturnValue({
                text: '    Expenses:Food ',
                lineNumber: 1
            });

            const position = new vscode.Position(0, 19);
            const result = tabCommand['analyzeTabContext'](mockDocument, position);

            expect(result.shouldAlign).toBe(true);
            expect(result.type).toBe('move_to_amount_position');
        });
    });

    describe('extractAccountName', () => {
        it('should extract account name from posting line with amount', () => {
            const line = '    Expenses:Food    100.00';
            const result = tabCommand['extractAccountName'](line);

            expect(result).toBe('Expenses:Food');
        });

        it('should extract account name from posting line without amount', () => {
            const line = '    Expenses:Food';
            const result = tabCommand['extractAccountName'](line);

            expect(result).toBe('Expenses:Food');
        });

        it('should handle nested accounts', () => {
            const line = '    Assets:Cash:Bank    500.00';
            const result = tabCommand['extractAccountName'](line);

            expect(result).toBe('Assets:Cash:Bank');
        });

        it('should return null for empty line', () => {
            const line = '';
            const result = tabCommand['extractAccountName'](line);

            expect(result).toBeNull();
        });
    });

    describe('findAccountPosition', () => {
        it('should find correct account position', () => {
            const line = '    Expenses:Food';
            const result = tabCommand['findAccountPosition'](line);

            expect(result).toBe(4);
        });

        it('should handle tab indentation', () => {
            const line = '\tExpenses:Food';
            const result = tabCommand['findAccountPosition'](line);

            expect(result).toBe(1);
        });

        it('should handle no indentation', () => {
            const line = 'Expenses:Food';
            const result = tabCommand['findAccountPosition'](line);

            expect(result).toBe(0);
        });
    });

    describe('getOptimalAmountPosition', () => {
        beforeEach(() => {
            mockDocument.getText.mockReturnValue(`
2024/01/01 * Example transaction
    Expenses:Food    100.00
    Assets:Cash
`);
        });

        it('should calculate optimal position based on document alignment', async () => {
            mockDocument.lineAt.mockReturnValue({
                text: '    Expenses:Food',
                lineNumber: 2
            });

            const result = await tabCommand['getOptimalAmountPosition'](mockDocument, 2);

            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThan(0);
        });

        it('should handle parsing errors gracefully', async () => {
            // Mock the documentFormatter to return a failure
            const mockParseResult = failure(new Error('Parsing failed'));
            jest.spyOn(tabCommand['documentFormatter'], 'parseTransactions').mockReturnValue(mockParseResult);

            const result = await tabCommand['getOptimalAmountPosition'](mockDocument, 0);

            expect(result).toBeNull();
        });

        it('should return default position for empty document', async () => {
            mockDocument.getText.mockReturnValue('');
            mockDocument.lineAt.mockReturnValue({
                text: '    Expenses:Food',
                lineNumber: 1
            });

            const result = await tabCommand['getOptimalAmountPosition'](mockDocument, 0);

            expect(result).toBe(40); // Default position for empty documents
        });
    });

    describe('findTransactionForLine', () => {
        it('should find transaction containing the line', () => {
            const transactions: TransactionBlock[] = [
                {
                    headerLine: '2024/01/01 * Transaction 1',
                    headerLineNumber: 1 as any,
                    postings: [
                        {
                            originalLine: '    Expenses:Food    100.00',
                            lineNumber: 2 as any,
                            accountName: 'Expenses:Food',
                            amountPart: '100.00',
                            accountPosition: 4 as any,
                            amountPosition: 20 as any,
                            hasAmount: true
                        },
                        {
                            originalLine: '    Assets:Cash',
                            lineNumber: 3 as any,
                            accountName: 'Assets:Cash',
                            amountPart: '',
                            accountPosition: 4 as any,
                            amountPosition: 16 as any,
                            hasAmount: false
                        }
                    ],
                    alignmentColumn: 40 as any
                },
                {
                    headerLine: '2024/01/02 * Transaction 2',
                    headerLineNumber: 5 as any,
                    postings: [
                        {
                            originalLine: '    Expenses:Transport    50.00',
                            lineNumber: 6 as any,
                            accountName: 'Expenses:Transport',
                            amountPart: '50.00',
                            accountPosition: 4 as any,
                            amountPosition: 24 as any,
                            hasAmount: true
                        }
                    ],
                    alignmentColumn: 40 as any
                }
            ];

            const result = tabCommand['findTransactionForLine'](transactions, 2);

            expect(result).toBe(transactions[0]);
        });

        it('should return null for line not in any transaction', () => {
            const transactions: TransactionBlock[] = [
                {
                    headerLine: '2024/01/01 * Transaction',
                    headerLineNumber: 1 as any,
                    postings: [
                        {
                            originalLine: '    Expenses:Food    100.00',
                            lineNumber: 2 as any,
                            accountName: 'Expenses:Food',
                            amountPart: '100.00',
                            accountPosition: 4 as any,
                            amountPosition: 20 as any,
                            hasAmount: true
                        }
                    ],
                    alignmentColumn: 40 as any
                }
            ];

            const result = tabCommand['findTransactionForLine'](transactions, 10);

            expect(result).toBeNull();
        });
    });

    describe('dispose', () => {
        it('should dispose of the command', () => {
            const disposeSpy = jest.fn();
            (vscode.commands.registerTextEditorCommand as jest.Mock).mockReturnValue({ dispose: disposeSpy });

            const newCommand = new HLedgerTabCommand();
            newCommand.dispose();

            expect(disposeSpy).toHaveBeenCalled();
        });
    });
});