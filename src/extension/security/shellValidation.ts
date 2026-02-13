// Shell metacharacter pattern for path validation
// Prevents command injection by rejecting paths with shell special characters
const SHELL_METACHAR_PATTERN = /[;&|`$()[\]{}^"<>#!*?~\\'\n\r]/;

/**
 * Validates that a path doesn't contain shell metacharacters
 * @param path - The path to validate
 * @throws Error if path contains shell metacharacters
 */
export function validatePathSafety(path: string): void {
  if (SHELL_METACHAR_PATTERN.test(path)) {
    throw new Error(`Path contains shell metacharacters: ${path}`);
  }
}
