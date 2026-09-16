// Path validation for values that reach an external process.
//
// The hledger CLI is invoked through child_process.execFile, which passes an
// argv array straight to the executable without a shell. Shell metacharacters
// (`;`, `|`, `(`, `)`, `$`, backticks, ...) therefore have no special meaning,
// and rejecting them only refused legitimate paths such as
// "/Users/me/Taxes (2024)/main.journal".
//
// What is still rejected is what cannot be an OS path at all: a NUL byte, and
// the line breaks that would forge extra lines in the report comment or in a
// log message built from the path.

const UNSAFE_PATH_CHARACTERS = /[\0\n\r]/;

/**
 * Validates that a path can be passed to execFile and safely interpolated into
 * a single-line message.
 * @param path - The path to validate
 * @throws Error if the path contains a NUL byte or a line break
 */
export function validatePathSafety(path: string): void {
  if (UNSAFE_PATH_CHARACTERS.test(path)) {
    throw new Error(`Path contains characters that cannot appear in a path: ${JSON.stringify(path)}`);
  }
}
