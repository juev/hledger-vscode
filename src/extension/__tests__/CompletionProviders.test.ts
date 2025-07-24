import * as vscode from 'vscode';
import { 
    AccountCompletionProvider, 
    CommodityCompletionProvider, 
    DateCompletionProvider, 
    KeywordCompletionProvider,
    HLedgerConfig 
} from '../main';

// No module mocking - use actual implementation

// Create test content with accounts, commodities, and dates
const testJournalContent = `
account Assets:Bank
account Expenses:Food

commodity RUB
commodity EUR

2025-01-14 Previous transaction
    Assets:Bank    50.00 EUR
    Expenses:Food

2025-01-15 Test transaction
    Assets:Cash    100.00 USD
    Активы:Наличные    200.00 RUB
    Expenses:Food
`;

const mockDocument = {
    uri: vscode.Uri.file('/test/test.journal'),
    languageId: 'hledger',
    lineAt: jest.fn(),
    getText: jest.fn().mockReturnValue(testJournalContent)
} as any;

const mockPosition = (line: number, character: number): vscode.Position => ({
    line,
    character
} as vscode.Position);

describe('KeywordCompletionProvider', () => {
    let provider: KeywordCompletionProvider;
    
    beforeEach(() => {
        provider = new KeywordCompletionProvider();
        jest.clearAllMocks();
    });
    
    it('should provide keyword completions on empty lines', () => {
        mockDocument.lineAt.mockReturnValue({ text: '  ' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 2)
        ) as vscode.CompletionItem[];
        
        expect(items).toBeDefined();
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].label).toBe('account');
        expect(items[0].kind).toBe(vscode.CompletionItemKind.Keyword);
        expect(items[0].detail).toBe('hledger directive');
    });
    
    it('should not provide completions on non-empty lines', () => {
        mockDocument.lineAt.mockReturnValue({ text: 'account Assets' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 14)
        );
        
        expect(items).toBeUndefined();
    });
});

describe('AccountCompletionProvider', () => {
    let provider: AccountCompletionProvider;
    
    beforeEach(() => {
        provider = new AccountCompletionProvider();
        jest.clearAllMocks();
    });
    
    it('should provide account completions on posting lines', () => {
        mockDocument.lineAt.mockReturnValue({ text: '    As' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 6)
        ) as vscode.CompletionItem[];
        
        expect(items).toBeDefined();
        expect(items.length).toBeGreaterThan(0);
        
        // Should include accounts starting with 'As'
        const labels = items.map(item => item.label);
        expect(labels).toContain('Assets:Bank');
        expect(labels).toContain('Assets:Cash');
        expect(labels).toContain('Assets'); // Default prefix
    });
    
    it('should provide Cyrillic account completions', () => {
        mockDocument.lineAt.mockReturnValue({ text: '    Акт' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 7)
        ) as vscode.CompletionItem[];
        
        expect(items).toBeDefined();
        const labels = items.map(item => item.label);
        expect(labels).toContain('Активы:Наличные');
    });
    
    it('should prioritize defined accounts over used accounts', () => {
        mockDocument.lineAt.mockReturnValue({ text: '    ' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 4)
        ) as vscode.CompletionItem[];
        
        const definedAccount = items.find(item => item.label === 'Assets:Bank');
        const usedAccount = items.find(item => item.label === 'Assets:Cash');
        
        expect((definedAccount?.sortText || '').localeCompare(usedAccount?.sortText || '')).toBeLessThan(0);
    });
    
    it('should not provide completions on non-posting lines', () => {
        mockDocument.lineAt.mockReturnValue({ text: '2025-01-15 Test' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 15)
        );
        
        expect(items).toBeUndefined();
    });
});

describe('CommodityCompletionProvider', () => {
    let provider: CommodityCompletionProvider;
    
    beforeEach(() => {
        provider = new CommodityCompletionProvider();
        jest.clearAllMocks();
    });
    
    it('should provide commodity completions after amounts', () => {
        mockDocument.lineAt.mockReturnValue({ text: '    Assets:Cash    100.50 ' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 26)
        ) as vscode.CompletionItem[];
        
        expect(items).toBeDefined();
        expect(items.length).toBeGreaterThan(0);
        
        // Should include configured commodities
        const labels = items.map(item => item.label);
        expect(labels).toContain('RUB');
        expect(labels).toContain('EUR');
        
        // Should include default commodities
        expect(labels).toContain('USD');
        expect(labels).toContain('BTC');
    });
    
    it('should provide completions after negative amounts', () => {
        mockDocument.lineAt.mockReturnValue({ text: '    Expenses:Food    -50.25 ' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 28)
        ) as vscode.CompletionItem[];
        
        expect(items).toBeDefined();
        expect(items.length).toBeGreaterThan(0);
    });
    
    it('should not provide completions without amount', () => {
        mockDocument.lineAt.mockReturnValue({ text: '    Assets:Cash    ' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 19)
        );
        
        expect(items).toBeUndefined();
    });
});

describe('DateCompletionProvider', () => {
    let provider: DateCompletionProvider;
    
    beforeEach(() => {
        provider = new DateCompletionProvider();
        jest.clearAllMocks();
        
        // Mock Date to have consistent test results
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });
    
    afterEach(() => {
        jest.useRealTimers();
    });
    
    it('should provide date completions on empty lines', () => {
        mockDocument.lineAt.mockReturnValue({ text: '' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 0)
        ) as vscode.CompletionItem[];
        
        expect(items).toBeDefined();
        expect(items.length).toBeGreaterThan(0);
        
        const labels = items.map(item => item.label);
        expect(labels).toContain('2025-01-14'); // Last used date
        expect(labels).toContain('2025-01-15'); // Today
        expect(labels).toContain('2025-01-14'); // Yesterday
    });
    
    it('should provide completions for partial dates', () => {
        mockDocument.lineAt.mockReturnValue({ text: '2025-' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 5)
        ) as vscode.CompletionItem[];
        
        expect(items).toBeDefined();
        expect(items.length).toBeGreaterThan(0);
    });
    
    it('should include space after date insertion', () => {
        mockDocument.lineAt.mockReturnValue({ text: '' });
        
        const items = provider.provideCompletionItems(
            mockDocument,
            mockPosition(0, 0)
        ) as vscode.CompletionItem[];
        
        const todayItem = items.find(item => item.detail === 'Today\'s date');
        expect(todayItem?.insertText).toBe('2025-01-15 ');
    });
});