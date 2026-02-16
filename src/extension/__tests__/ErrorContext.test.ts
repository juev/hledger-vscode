import { getErrorContext, formatErrorWithContext } from '../ErrorContext';

describe('ErrorContext', () => {
  describe('getErrorContext', () => {
    it('should return platform info', () => {
      const ctx = getErrorContext();

      expect(ctx).toContain(process.platform);
      expect(ctx).toContain(process.arch);
    });

    it('should return extension version', () => {
      const ctx = getErrorContext();

      expect(ctx).toMatch(/v\d+\.\d+\.\d+/);
    });
  });

  describe('formatErrorWithContext', () => {
    it('should append context to error message', () => {
      const formatted = formatErrorWithContext('Something failed');

      expect(formatted).toContain('Something failed');
      expect(formatted).toContain(process.platform);
    });

    it('should include error details when provided', () => {
      const err = new Error('timeout');
      const formatted = formatErrorWithContext('Request failed', err);

      expect(formatted).toContain('Request failed');
      expect(formatted).toContain('timeout');
    });
  });
});
