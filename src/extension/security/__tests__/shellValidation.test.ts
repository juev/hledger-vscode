import { validatePathSafety } from '../shellValidation';

describe('validatePathSafety', () => {
  it('accepts paths with shell metacharacters, which execFile never interprets', () => {
    expect(() => validatePathSafety('/Users/me/Taxes (2024)/main.journal')).not.toThrow();
    expect(() => validatePathSafety('/Users/me/a;b|c&d/main.journal')).not.toThrow();
    expect(() => validatePathSafety('/Users/me/$HOME `x` [1]/main.journal')).not.toThrow();
    expect(() => validatePathSafety('C:\\Users\\me\\My Docs\\main.journal')).not.toThrow();
  });

  it('rejects a NUL byte', () => {
    expect(() => validatePathSafety('/tmp/a\0b.journal')).toThrow(/cannot appear/);
  });

  it('rejects line breaks that would forge extra lines', () => {
    expect(() => validatePathSafety('/tmp/a\n; injected.journal')).toThrow(/cannot appear/);
    expect(() => validatePathSafety('/tmp/a\rb.journal')).toThrow(/cannot appear/);
  });
});
