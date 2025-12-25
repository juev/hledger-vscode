import { DateParser } from '../DateParser';

describe('DateParser', () => {
  describe('auto-detection mode', () => {
    let parser: DateParser;

    beforeEach(() => {
      parser = new DateParser('auto');
    });

    it('should parse ISO format (YYYY-MM-DD)', () => {
      const result = parser.parse('2024-01-15');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });

    it('should parse slash ISO format (YYYY/MM/DD)', () => {
      const result = parser.parse('2024/01/15');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });

    it('should parse European dot format (DD.MM.YYYY)', () => {
      const result = parser.parse('15.01.2024');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });

    it('should parse European slash format (DD/MM/YYYY)', () => {
      const result = parser.parse('15/01/2024');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });

    it('should parse European dash format (DD-MM-YYYY)', () => {
      const result = parser.parse('15-01-2024');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });

    it('should handle single-digit day and month', () => {
      const result = parser.parse('2024-1-5');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-05');
      }
    });
  });

  describe('specific format mode', () => {
    it('should parse MM/DD/YYYY when specified', () => {
      const parser = new DateParser('MM/DD/YYYY');
      const result = parser.parse('01/15/2024');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });

    it('should parse DD/MM/YYYY when specified', () => {
      const parser = new DateParser('DD/MM/YYYY');
      const result = parser.parse('15/01/2024');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });
  });

  describe('validation', () => {
    let parser: DateParser;

    beforeEach(() => {
      parser = new DateParser('auto');
    });

    it('should reject invalid month', () => {
      const result = parser.parse('2024-13-15');
      expect(result.success).toBe(false);
    });

    it('should reject invalid day', () => {
      const result = parser.parse('2024-01-32');
      expect(result.success).toBe(false);
    });

    it('should reject invalid February date (non-leap year)', () => {
      const result = parser.parse('2023-02-29');
      expect(result.success).toBe(false);
    });

    it('should accept valid February date (leap year)', () => {
      const result = parser.parse('2024-02-29');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-02-29');
      }
    });

    it('should reject empty string', () => {
      const result = parser.parse('');
      expect(result.success).toBe(false);
    });

    it('should reject invalid format', () => {
      const result = parser.parse('not-a-date');
      expect(result.success).toBe(false);
    });
  });

  describe('format detection', () => {
    let parser: DateParser;

    beforeEach(() => {
      parser = new DateParser('auto');
    });

    it('should detect ISO format from samples', () => {
      const samples = ['2024-01-15', '2024-02-20', '2024-03-25'];
      const format = parser.detectFormat(samples);
      expect(format).toBe('YYYY-MM-DD');
    });

    it('should detect European dot format from samples', () => {
      const samples = ['15.01.2024', '20.02.2024', '25.03.2024'];
      const format = parser.detectFormat(samples);
      expect(format).toBe('DD.MM.YYYY');
    });

    it('should return auto for mixed formats', () => {
      const samples = ['2024-01-15', '15/01/2024', '01.15.2024'];
      const format = parser.detectFormat(samples);
      expect(format).toBe('auto');
    });

    it('should return auto for empty samples', () => {
      const format = parser.detectFormat([]);
      expect(format).toBe('auto');
    });
  });

  describe('disambiguateSlashFormat', () => {
    it('should detect DD/MM/YYYY when first part > 12', () => {
      const samples = ['15/01/2024', '20/02/2024', '25/03/2024'];
      const format = DateParser.disambiguateSlashFormat(samples);
      expect(format).toBe('DD/MM/YYYY');
    });

    it('should detect MM/DD/YYYY when second part > 12', () => {
      const samples = ['01/15/2024', '02/20/2024', '03/25/2024'];
      const format = DateParser.disambiguateSlashFormat(samples);
      expect(format).toBe('MM/DD/YYYY');
    });

    it('should default to DD/MM/YYYY when ambiguous', () => {
      const samples = ['01/05/2024', '02/06/2024', '03/07/2024'];
      const format = DateParser.disambiguateSlashFormat(samples);
      expect(format).toBe('DD/MM/YYYY');
    });
  });

  describe('edge cases', () => {
    let parser: DateParser;

    beforeEach(() => {
      parser = new DateParser('auto');
    });

    it('should handle whitespace around date', () => {
      const result = parser.parse('  2024-01-15  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-15');
      }
    });

    it('should handle year boundary', () => {
      const result = parser.parse('2024-12-31');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-12-31');
      }
    });

    it('should handle first day of year', () => {
      const result = parser.parse('2024-01-01');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('2024-01-01');
      }
    });
  });
});
