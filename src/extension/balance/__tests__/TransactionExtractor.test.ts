import { TransactionExtractor } from '../TransactionExtractor';

describe('TransactionExtractor', () => {
    let extractor: TransactionExtractor;

    beforeEach(() => {
        extractor = new TransactionExtractor();
    });

    describe('extractTransactions', () => {
        it('should extract single transaction with two postings', () => {
            const content = `2024-01-15 Grocery Store
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
            expect(transactions[0]!.date).toBe('2024-01-15');
            expect(transactions[0]!.description).toBe('Grocery Store');
            expect(transactions[0]!.headerLineNumber).toBe(0);
            expect(transactions[0]!.postings).toHaveLength(2);
        });

        it('should extract multiple transactions', () => {
            const content = `2024-01-15 Grocery Store
    Expenses:Food    $50
    Assets:Cash

2024-01-16 Gas Station
    Expenses:Transportation    $30
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(2);
            expect(transactions[0]!.date).toBe('2024-01-15');
            expect(transactions[1]!.date).toBe('2024-01-16');
        });

        it('should handle transaction at end of file without newline', () => {
            const content = `2024-01-15 Test
    Expenses:Test    $100
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
            expect(transactions[0]!.postings).toHaveLength(2);
        });

        it('should extract posting amounts correctly', () => {
            const content = `2024-01-15 Test
    Expenses:Food    $50.00
    Assets:Cash    -$50.00`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings[0]!.amount).not.toBeNull();
            expect(transactions[0]!.postings[0]!.amount!.value).toBe(50);
            expect(transactions[0]!.postings[1]!.amount!.value).toBe(-50);
        });

        it('should handle inferred amounts (null)', () => {
            const content = `2024-01-15 Test
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings[0]!.amount).not.toBeNull();
            expect(transactions[0]!.postings[1]!.amount).toBeNull();
        });

        it('should preserve line numbers', () => {
            const content = `; Comment line

2024-01-15 Test
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.headerLineNumber).toBe(2);
            expect(transactions[0]!.postings[0]!.lineNumber).toBe(3);
            expect(transactions[0]!.postings[1]!.lineNumber).toBe(4);
        });

        it('should handle virtual postings', () => {
            const content = `2024-01-15 Test
    Expenses:Food    $50
    Assets:Cash    -$50
    (Budget:Food)    $50`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings).toHaveLength(3);
            expect(transactions[0]!.postings[2]!.type).toBe('unbalancedVirtual');
            expect(transactions[0]!.postings[2]!.account).toBe('Budget:Food');
        });

        it('should handle balanced virtual postings', () => {
            const content = `2024-01-15 Test
    Expenses:Food    $50
    Assets:Cash    -$50
    [Budget:Food]    -$50
    [Budget:Available]    $50`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings).toHaveLength(4);
            expect(transactions[0]!.postings[2]!.type).toBe('balancedVirtual');
            expect(transactions[0]!.postings[3]!.type).toBe('balancedVirtual');
        });

        it('should ignore comment lines', () => {
            const content = `2024-01-15 Test
    ; This is a comment
    Expenses:Food    $50
    # Another comment
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings).toHaveLength(2);
        });

        it('should handle status marks', () => {
            const content = `2024-01-15 * Cleared Transaction
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.description).toContain('Cleared Transaction');
        });

        it('should handle transaction codes', () => {
            const content = `2024-01-15 (12345) Payment
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
        });

        it('should skip periodic transactions', () => {
            const content = `~ monthly
    Expenses:Rent    $2000
    Assets:Checking

2024-01-15 Regular Transaction
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
            expect(transactions[0]!.date).toBe('2024-01-15');
        });

        it('should skip auto posting rules', () => {
            const content = `= expenses
    (budget:expenses)    *-1

2024-01-15 Test
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
            expect(transactions[0]!.date).toBe('2024-01-15');
        });

        it('should handle transactions without postings', () => {
            const content = `2024-01-15 Empty Transaction

2024-01-16 Valid Transaction
    Expenses:Food    $50
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
            expect(transactions[0]!.date).toBe('2024-01-16');
        });

        it('should handle cost notation in postings', () => {
            const content = `2024-01-15 Stock Purchase
    Assets:Stocks    10 AAPL @ $150
    Assets:Cash    -$1500`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings[0]!.amount!.cost).toBeDefined();
            expect(transactions[0]!.postings[0]!.amount!.cost!.value).toBe(150);
        });

        it('should handle balance assertions', () => {
            const content = `2024-01-15 Reconcile
    Assets:Checking    $0 = $5000
    Equity:Adjustment`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings[0]!.amount!.value).toBe(0);
            expect(transactions[0]!.postings[0]!.amount!.isBalanceAssertionOnly).toBe(false);
        });

        it('should handle balance assertion only posting', () => {
            const content = `2024-01-15 Balance Check
    Assets:Checking    = $5000
    Expenses:Adjustment    $0`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions[0]!.postings[0]!.amount!.isBalanceAssertionOnly).toBe(true);
        });

        it('should handle directives between transactions', () => {
            const content = `2024-01-15 First
    Expenses:Food    $50
    Assets:Cash

account Assets:Savings

2024-01-16 Second
    Expenses:Food    $30
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(2);
        });

        it('should handle unicode account names', () => {
            const content = `2024-01-15 Покупка
    Расходы:Продукты    1000 ₽
    Активы:Наличные`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
            expect(transactions[0]!.postings[0]!.account).toBe('Расходы:Продукты');
        });

        it('should handle multiple empty lines between transactions', () => {
            const content = `2024-01-15 First
    Expenses:Food    $50
    Assets:Cash



2024-01-16 Second
    Expenses:Food    $30
    Assets:Cash`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(2);
        });

        it('should handle total balance assertion (double equals)', () => {
            const content = `2024-01-01 Test
    Assets:Checking  == $500
    Income:Salary`;

            const transactions = extractor.extractTransactions(content);

            expect(transactions).toHaveLength(1);
            expect(transactions[0]!.postings).toHaveLength(2);
            expect(transactions[0]!.postings[0]!.amount).not.toBeNull();
            expect(transactions[0]!.postings[0]!.amount!.isBalanceAssertionOnly).toBe(true);
            expect(transactions[0]!.postings[1]!.amount).toBeNull();
        });
    });
});
