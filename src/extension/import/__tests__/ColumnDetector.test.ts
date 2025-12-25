import { ColumnDetector } from '../ColumnDetector';
import { ParsedRow } from '../types';

describe('ColumnDetector', () => {
  let detector: ColumnDetector;

  beforeEach(() => {
    detector = new ColumnDetector();
  });

  describe('header matching', () => {
    it('should detect date column', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const dateMapping = mappings.find((m) => m.type === 'date');
      expect(dateMapping).toBeDefined();
      expect(dateMapping?.index).toBe(0);
      expect(dateMapping?.confidence).toBeGreaterThan(0.8);
    });

    it('should detect description column', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const descMapping = mappings.find((m) => m.type === 'description');
      expect(descMapping).toBeDefined();
      expect(descMapping?.index).toBe(1);
    });

    it('should detect amount column', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const amountMapping = mappings.find((m) => m.type === 'amount');
      expect(amountMapping).toBeDefined();
      expect(amountMapping?.index).toBe(2);
    });

    it('should detect category column', () => {
      const headers = ['Date', 'Description', 'Amount', 'Category'];
      const mappings = detector.detectColumns(headers, []);

      const categoryMapping = mappings.find((m) => m.type === 'category');
      expect(categoryMapping).toBeDefined();
      expect(categoryMapping?.index).toBe(3);
    });

    it('should detect debit and credit columns', () => {
      const headers = ['Date', 'Description', 'Debit', 'Credit'];
      const mappings = detector.detectColumns(headers, []);

      const debitMapping = mappings.find((m) => m.type === 'debit');
      const creditMapping = mappings.find((m) => m.type === 'credit');

      expect(debitMapping).toBeDefined();
      expect(debitMapping?.index).toBe(2);
      expect(creditMapping).toBeDefined();
      expect(creditMapping?.index).toBe(3);
    });

    it('should detect payee column', () => {
      const headers = ['Date', 'Payee', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const payeeMapping = mappings.find((m) => m.type === 'payee');
      expect(payeeMapping).toBeDefined();
      expect(payeeMapping?.index).toBe(1);
    });

    it('should detect reference column', () => {
      const headers = ['Date', 'Reference', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const refMapping = mappings.find((m) => m.type === 'reference');
      expect(refMapping).toBeDefined();
      expect(refMapping?.index).toBe(1);
    });

    it('should detect currency column', () => {
      const headers = ['Date', 'Description', 'Amount', 'Currency'];
      const mappings = detector.detectColumns(headers, []);

      const currMapping = mappings.find((m) => m.type === 'currency');
      expect(currMapping).toBeDefined();
      expect(currMapping?.index).toBe(3);
    });
  });

  describe('Russian headers', () => {
    it('should detect Russian date column', () => {
      const headers = ['Дата', 'Описание', 'Сумма'];
      const mappings = detector.detectColumns(headers, []);

      const dateMapping = mappings.find((m) => m.type === 'date');
      expect(dateMapping).toBeDefined();
      expect(dateMapping?.index).toBe(0);
    });

    it('should detect Russian amount column', () => {
      const headers = ['Дата', 'Описание', 'Сумма'];
      const mappings = detector.detectColumns(headers, []);

      const amountMapping = mappings.find((m) => m.type === 'amount');
      expect(amountMapping).toBeDefined();
      expect(amountMapping?.index).toBe(2);
    });

    it('should detect Russian category column', () => {
      const headers = ['Дата', 'Описание', 'Сумма', 'Категория'];
      const mappings = detector.detectColumns(headers, []);

      const categoryMapping = mappings.find((m) => m.type === 'category');
      expect(categoryMapping).toBeDefined();
      expect(categoryMapping?.index).toBe(3);
    });
  });

  describe('content-based detection', () => {
    const createRows = (data: string[][]): ParsedRow[] => {
      return data.map((cells, index) => ({
        cells,
        lineNumber: index + 2,
      }));
    };

    it('should detect date column by content', () => {
      const headers = ['Col1', 'Col2', 'Col3'];
      const rows = createRows([
        ['2024-01-15', 'Description', '50.00'],
        ['2024-01-16', 'Another', '30.00'],
      ]);

      const mappings = detector.detectColumns(headers, rows);
      const dateMapping = mappings.find((m) => m.type === 'date');
      expect(dateMapping).toBeDefined();
      expect(dateMapping?.index).toBe(0);
    });

    it('should detect amount column by content', () => {
      const headers = ['Col1', 'Col2', 'Col3'];
      const rows = createRows([
        ['2024-01-15', 'Description', '1,234.56'],
        ['2024-01-16', 'Another', '30.00'],
      ]);

      const mappings = detector.detectColumns(headers, rows);
      const amountMapping = mappings.find((m) => m.type === 'amount');
      expect(amountMapping).toBeDefined();
      expect(amountMapping?.index).toBe(2);
    });

    it('should detect currency column by content', () => {
      const headers = ['Date', 'Description', 'Amount', 'Curr'];
      const rows = createRows([
        ['2024-01-15', 'Description', '50.00', 'USD'],
        ['2024-01-16', 'Another', '30.00', 'EUR'],
      ]);

      const mappings = detector.detectColumns(headers, rows);
      const currMapping = mappings.find((m) => m.type === 'currency');
      expect(currMapping).toBeDefined();
      expect(currMapping?.index).toBe(3);
    });
  });

  describe('findMapping helper', () => {
    it('should find mapping by type', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const dateMapping = ColumnDetector.findMapping(mappings, 'date');
      expect(dateMapping).toBeDefined();
      expect(dateMapping?.type).toBe('date');
    });

    it('should return undefined for missing type', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const categoryMapping = ColumnDetector.findMapping(mappings, 'category');
      expect(categoryMapping).toBeUndefined();
    });
  });

  describe('hasRequiredColumns validation', () => {
    it('should pass with date and amount', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const result = ColumnDetector.hasRequiredColumns(mappings);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should pass with date and debit/credit', () => {
      const headers = ['Date', 'Description', 'Debit', 'Credit'];
      const mappings = detector.detectColumns(headers, []);

      const result = ColumnDetector.hasRequiredColumns(mappings);
      expect(result.valid).toBe(true);
    });

    it('should fail without date', () => {
      const headers = ['Col1', 'Col2', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      // Override to mark first column as unknown
      const modifiedMappings = mappings.map((m) =>
        m.index === 0 ? { ...m, type: 'unknown' as const } : m
      );

      const result = ColumnDetector.hasRequiredColumns(modifiedMappings);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('date');
    });
  });

  describe('conflict resolution', () => {
    it('should handle duplicate type detection by confidence', () => {
      const headers = ['Date', 'Transaction Date', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      // Should only have one date mapping
      const dateMappings = mappings.filter((m) => m.type === 'date');
      expect(dateMappings).toHaveLength(1);
    });
  });

  describe('word boundary matching', () => {
    it('should give high confidence for exact regex match', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const mappings = detector.detectColumns(headers, []);

      const dateMapping = mappings.find((m) => m.type === 'date');
      expect(dateMapping?.confidence).toBe(0.95);
    });

    it('should give medium confidence for word boundary match', () => {
      // Using headers that do NOT match exact regex patterns
      // but have keywords at word boundaries
      const headers = ['MY_DATE_FIELD', 'THE_DESC_INFO', 'TOTAL_AMOUNT_VAL'];
      const mappings = detector.detectColumns(headers, []);

      // Word boundary match should have confidence 0.75
      const dateMapping = mappings.find((m) => m.type === 'date');
      expect(dateMapping?.confidence).toBe(0.75);
    });

    it('should give lower confidence for substring match', () => {
      // Headers with keywords embedded without word boundaries
      const headers = ['MYDATEFIELD', 'FULLDESCRIPTION', 'TOTALAMOUNT'];
      const mappings = detector.detectColumns(headers, []);

      // Substring match should have confidence 0.55
      const descMapping = mappings.find((m) => m.type === 'description');
      expect(descMapping?.confidence).toBe(0.55);
    });

    it('should not match DESCRIPTION as DESC with high confidence', () => {
      // This is the false positive case: "DESCRIPTION" contains "DESC"
      // but should NOT match DESC keyword with word boundary
      const headers = ['DESCRIPTION'];
      const mappings = detector.detectColumns(headers, []);

      const descMapping = mappings.find((m) => m.type === 'description');
      // Should match via exact regex pattern (description), not DESC substring
      expect(descMapping).toBeDefined();
      expect(descMapping?.confidence).toBe(0.95);
    });

    it('should match DESC as word boundary with medium confidence', () => {
      // "DESC_COLUMN" contains "DESC" at word boundary
      const headers = ['DESC_COLUMN'];
      const mappings = detector.detectColumns(headers, []);

      const descMapping = mappings.find((m) => m.type === 'description');
      expect(descMapping).toBeDefined();
      expect(descMapping?.confidence).toBe(0.75);
    });

    it('should handle Russian word boundaries correctly', () => {
      // Russian keywords at word boundaries (not matching exact regex)
      const headers = ['МОЯ_ДАТА_ПОЛЕ', 'ОПИСАНИЕ_ДАННЫЕ', 'ИТОГО_СУММА_ПЛАТЕЖ'];
      const mappings = detector.detectColumns(headers, []);

      const dateMapping = mappings.find((m) => m.type === 'date');
      expect(dateMapping).toBeDefined();
      // Word boundary match for дата
      expect(dateMapping?.confidence).toBe(0.75);
    });

    it('should prefer exact match over word boundary match', () => {
      // "Date" should get 0.95 from exact regex, not 0.75 from word boundary
      const headers = ['Date'];
      const mappings = detector.detectColumns(headers, []);

      const dateMapping = mappings.find((m) => m.type === 'date');
      expect(dateMapping?.confidence).toBe(0.95);
    });

    it('should prefer word boundary over substring match', () => {
      // "MY_AMOUNT_FIELD" has "amount" at word boundary
      // "MYAMOUNTFIELD" has "amount" as substring only
      // When both map to same type, conflict resolution keeps higher confidence
      const headers = ['MY_AMOUNT_FIELD', 'MYAMOUNTFIELD'];
      const mappings = detector.detectColumns(headers, []);

      const wordBoundaryMapping = mappings.find((m) => m.headerName === 'MY_AMOUNT_FIELD');
      const substringMapping = mappings.find((m) => m.headerName === 'MYAMOUNTFIELD');

      // Word boundary match should have higher confidence
      expect(wordBoundaryMapping?.confidence).toBe(0.75);
      expect(wordBoundaryMapping?.type).toBe('amount');

      // Substring match gets demoted to unknown due to conflict resolution
      // (only one column can have the 'amount' type)
      expect(substringMapping?.type).toBe('unknown');
    });

    it('should give substring confidence when no conflict exists', () => {
      // Single header with substring match only
      const headers = ['MYAMOUNTFIELD'];
      const mappings = detector.detectColumns(headers, []);

      const amountMapping = mappings.find((m) => m.type === 'amount');
      expect(amountMapping).toBeDefined();
      expect(amountMapping?.confidence).toBe(0.55);
    });
  });
});
