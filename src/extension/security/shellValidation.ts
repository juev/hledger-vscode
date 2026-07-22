// Shell metacharacter pattern for path validation.
// Backslash is excluded: it is the Windows path separator, not a shell
// metacharacter in the contexts where this validation applies (execFile /
// Executable — no shell is spawned).  Characters #, ~, ' are legitimate in
// file paths and are also excluded.
const SHELL_METACHAR_PATTERN = /[;|&`$()[\]{}^"<>\n\r]/;

/**
 * Validates that a path doesn't contain shell metacharacters.
 * Use only where a path is interpolated into a shell command.
 * @param path - The path to validate
 * @throws Error if path contains shell metacharacters
 */
export function validatePathSafety(path: string): void {
  if (SHELL_METACHAR_PATTERN.test(path)) {
    throw new Error(`Path contains shell metacharacters: ${path}`);
  }
}
