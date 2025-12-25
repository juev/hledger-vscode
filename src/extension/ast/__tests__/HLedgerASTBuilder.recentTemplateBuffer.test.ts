// HLedgerASTBuilder.recentTemplateBuffer.test.ts - Tests for circular buffer tracking of recent templates
import { HLedgerASTBuilder } from '../HLedgerASTBuilder';
import { HLedgerLexer } from '../../lexer/HLedgerLexer';
import { PayeeName, TemplateKey, generateTemplateKey } from '../../types';

describe('HLedgerASTBuilder - Recent Template Buffer', () => {
  let builder: HLedgerASTBuilder;
  let lexer: HLedgerLexer;

  beforeEach(() => {
    builder = new HLedgerASTBuilder();
    lexer = new HLedgerLexer();
  });

  describe('circular buffer behavior', () => {
    it('should store template keys in buffer as transactions are processed', () => {
      const content = `
2024-12-20 Coffee Shop
    Expenses:Food:Coffee    $5.00
    Assets:Cash

2024-12-21 Coffee Shop
    Expenses:Food:Coffee    $4.50
    Assets:Cash

2024-12-22 Coffee Shop
    Expenses:Food:Coffee    $5.50
    Assets:Cash
`;
      const tokens = lexer.tokenizeContent(content);
      const data = builder.buildFromTokens(tokens);

      // Buffer should contain 3 entries for 3 transactions
      const buffer = data.payeeRecentTemplates.get('Coffee Shop' as PayeeName);
      expect(buffer).toBeDefined();
      expect(buffer!.keys.length).toBe(3);
    });

    it('should track multiple different templates in buffer', () => {
      const content = `
2024-12-20 Grocery Store
    Expenses:Food    $50.00
    Assets:Cash

2024-12-21 Grocery Store
    Expenses:Food    $30.00
    Assets:Bank:Checking

2024-12-22 Grocery Store
    Expenses:Food    $40.00
    Assets:Cash
`;
      const tokens = lexer.tokenizeContent(content);
      const data = builder.buildFromTokens(tokens);

      const buffer = data.payeeRecentTemplates.get('Grocery Store' as PayeeName);
      expect(buffer).toBeDefined();
      expect(buffer!.keys.length).toBe(3);

      // Template with Cash should appear twice, Bank:Checking once
      const cashKey = generateTemplateKey(['Assets:Cash', 'Expenses:Food']);
      const bankKey = generateTemplateKey(['Assets:Bank:Checking', 'Expenses:Food']);

      const cashCount = buffer!.keys.filter((k) => k === cashKey).length;
      const bankCount = buffer!.keys.filter((k) => k === bankKey).length;

      expect(cashCount).toBe(2);
      expect(bankCount).toBe(1);
    });

    it('should wrap around when buffer exceeds 50 transactions', () => {
      // Generate 55 transactions alternating between two templates
      const transactions: string[] = [];
      const template1Accounts = ['Expenses:Food', 'Assets:Cash'];
      const template2Accounts = ['Expenses:Food', 'Assets:Bank'];

      for (let i = 1; i <= 55; i++) {
        const date = `2024-01-${String((i % 28) + 1).padStart(2, '0')}`;
        const accounts = i % 2 === 0 ? template1Accounts : template2Accounts;
        transactions.push(`
${date} Test Payee
    ${accounts[0]}    $10.00
    ${accounts[1]}
`);
      }

      const content = transactions.join('\n');
      const tokens = lexer.tokenizeContent(content);
      const data = builder.buildFromTokens(tokens);

      const buffer = data.payeeRecentTemplates.get('Test Payee' as PayeeName);
      expect(buffer).toBeDefined();

      // Buffer should wrap to 50 entries
      expect(buffer!.keys.length).toBe(50);

      // writeIndex should reflect the wrap-around position
      expect(buffer!.writeIndex).toBe(5); // 55 % 50 = 5
    });

    it('should correctly count frequency of templates in buffer', () => {
      // Create 10 transactions: 7 with template A, 3 with template B
      const templateA = ['Expenses:Food', 'Assets:Cash'];
      const templateB = ['Expenses:Food', 'Assets:Bank'];

      const content = `
2024-12-01 Frequency Test
    ${templateA[0]}    $10.00
    ${templateA[1]}

2024-12-02 Frequency Test
    ${templateA[0]}    $10.00
    ${templateA[1]}

2024-12-03 Frequency Test
    ${templateB[0]}    $10.00
    ${templateB[1]}

2024-12-04 Frequency Test
    ${templateA[0]}    $10.00
    ${templateA[1]}

2024-12-05 Frequency Test
    ${templateA[0]}    $10.00
    ${templateA[1]}

2024-12-06 Frequency Test
    ${templateB[0]}    $10.00
    ${templateB[1]}

2024-12-07 Frequency Test
    ${templateA[0]}    $10.00
    ${templateA[1]}

2024-12-08 Frequency Test
    ${templateA[0]}    $10.00
    ${templateA[1]}

2024-12-09 Frequency Test
    ${templateB[0]}    $10.00
    ${templateB[1]}

2024-12-10 Frequency Test
    ${templateA[0]}    $10.00
    ${templateA[1]}
`;
      const tokens = lexer.tokenizeContent(content);
      const data = builder.buildFromTokens(tokens);

      const buffer = data.payeeRecentTemplates.get('Frequency Test' as PayeeName);
      expect(buffer).toBeDefined();
      expect(buffer!.keys.length).toBe(10);

      // Count frequencies
      const templateAKey = generateTemplateKey(templateA);
      const templateBKey = generateTemplateKey(templateB);

      const aCount = buffer!.keys.filter((k) => k === templateAKey).length;
      const bCount = buffer!.keys.filter((k) => k === templateBKey).length;

      expect(aCount).toBe(7);
      expect(bCount).toBe(3);
    });
  });

  describe('buffer merging', () => {
    it('should merge buffers from multiple sources', () => {
      const content1 = `
2024-12-01 Merge Payee
    Expenses:Food    $10.00
    Assets:Cash

2024-12-02 Merge Payee
    Expenses:Food    $20.00
    Assets:Cash
`;
      const content2 = `
2024-12-03 Merge Payee
    Expenses:Food    $30.00
    Assets:Bank

2024-12-04 Merge Payee
    Expenses:Food    $40.00
    Assets:Cash
`;
      const tokens1 = lexer.tokenizeContent(content1);
      const tokens2 = lexer.tokenizeContent(content2);

      const data1 = builder.buildFromTokens(tokens1);
      const data2 = builder.buildFromTokens(tokens2);

      const mutableData1 = builder.createMutableFromReadonly(data1);
      builder.mergeData(mutableData1, data2);
      const mergedData = builder.toReadonlyData(mutableData1);

      const buffer = mergedData.payeeRecentTemplates.get('Merge Payee' as PayeeName);
      expect(buffer).toBeDefined();

      // Should have all 4 transactions in buffer
      expect(buffer!.keys.length).toBe(4);
    });

    it('should limit merged buffer to 50 entries', () => {
      // Create two datasets with 30 transactions each
      const createContent = (startNum: number, count: number): string => {
        const transactions: string[] = [];
        for (let i = 0; i < count; i++) {
          const num = startNum + i;
          const date = `2024-${String((num % 12) + 1).padStart(2, '0')}-${String((num % 28) + 1).padStart(2, '0')}`;
          transactions.push(`
${date} Limit Test Payee
    Expenses:Item${num}    $10.00
    Assets:Cash${num}
`);
        }
        return transactions.join('\n');
      };

      const content1 = createContent(1, 30);
      const content2 = createContent(31, 30);

      const tokens1 = lexer.tokenizeContent(content1);
      const tokens2 = lexer.tokenizeContent(content2);

      const data1 = builder.buildFromTokens(tokens1);
      const data2 = builder.buildFromTokens(tokens2);

      const mutableData1 = builder.createMutableFromReadonly(data1);
      builder.mergeData(mutableData1, data2);
      const mergedData = builder.toReadonlyData(mutableData1);

      const buffer = mergedData.payeeRecentTemplates.get('Limit Test Payee' as PayeeName);
      expect(buffer).toBeDefined();

      // Should be capped at 50
      expect(buffer!.keys.length).toBeLessThanOrEqual(50);
    });

    it('should deep clone buffer during createMutableFromReadonly', () => {
      const content = `
2024-12-01 Clone Test
    Expenses:Food    $10.00
    Assets:Cash
`;
      const tokens = lexer.tokenizeContent(content);
      const data = builder.buildFromTokens(tokens);

      const mutableData = builder.createMutableFromReadonly(data);

      // Modify the cloned buffer
      const buffer = mutableData.payeeRecentTemplates.get('Clone Test' as PayeeName);
      if (buffer) {
        buffer.keys.push('NewKey' as TemplateKey);
      }

      // Original should be unchanged
      const originalBuffer = data.payeeRecentTemplates.get('Clone Test' as PayeeName);
      expect(originalBuffer!.keys.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty payee recent templates gracefully', () => {
      const content = `
2024-12-01 Single Posting Only
    Expenses:Food    $10.00
`;
      const tokens = lexer.tokenizeContent(content);
      const data = builder.buildFromTokens(tokens);

      // No template created for single posting transactions
      const buffer = data.payeeRecentTemplates.get('Single Posting Only' as PayeeName);
      expect(buffer).toBeUndefined();
    });

    it('should handle multiple payees independently', () => {
      const content = `
2024-12-01 Payee A
    Expenses:Food    $10.00
    Assets:Cash

2024-12-02 Payee B
    Expenses:Food    $20.00
    Assets:Bank

2024-12-03 Payee A
    Expenses:Food    $30.00
    Assets:Cash
`;
      const tokens = lexer.tokenizeContent(content);
      const data = builder.buildFromTokens(tokens);

      const bufferA = data.payeeRecentTemplates.get('Payee A' as PayeeName);
      const bufferB = data.payeeRecentTemplates.get('Payee B' as PayeeName);

      expect(bufferA).toBeDefined();
      expect(bufferB).toBeDefined();
      expect(bufferA!.keys.length).toBe(2);
      expect(bufferB!.keys.length).toBe(1);
    });
  });
});
