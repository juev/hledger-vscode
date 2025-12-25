# Troubleshooting Guide

Quick Navigation:

- [Installation Issues](#installation-issues)
- [Completion Problems](#completion-problems)
- [Inline Completions](#inline-completions-not-showing)
- [Performance Issues](#performance-issues)
- [CLI Integration](#cli-integration)
- [Syntax Highlighting](#syntax-highlighting)
- [Known Issues](#known-issues)
- [Getting Help](#getting-help)

---

## Installation Issues

### Extension Not Activating

**Symptoms:** Extension doesn't load, no hledger features available

**Solutions:**

1. Check file extension is `.journal`, `.hledger`, or `.ledger`
2. Verify language mode: Click language indicator (bottom-right) → Select "hledger"
3. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"

### File Association Problems

**Symptoms:** Files open as plain text

**Solutions:**

1. Right-click file → "Open With..." → "hledger"
2. Add to settings.json:

   ```json
   "files.associations": {
       "*.journal": "hledger",
       "*.hledger": "hledger",
       "*.ledger": "hledger"
   }
   ```

---

## Completion Problems

### Completions Not Appearing

**Symptoms:** No suggestions when typing

**Solutions:**

1. Manual trigger: Press `Ctrl+Space`
2. Check setting: `hledger.autoCompletion.enabled` should be `true`
3. Verify trigger characters work:
   - Type digit (0-9) for dates
   - Type `:` for account hierarchy
   - Type `@` for commodities
4. Check workspace: Completions need at least one transaction

### Wrong Suggestions

**Symptoms:** Irrelevant completions, wrong context

**Solutions:**

1. Completions are context-aware based on cursor position
2. Verify cursor is in correct position:
   - Line start (after date) → Payees
   - After account name → Sub-accounts
   - After amount → Commodities
3. Force refresh: Save file or reload window

### Slow Completions

**Symptoms:** Delay before suggestions appear

**Solutions:**

1. Large file? Consider splitting journals with `include`
2. Check CPU usage during completion
3. Try disabling semantic tokens: `"editor.semanticHighlighting.enabled": false`

### Inline Completions Not Showing

**Symptoms:** No ghost text suggestions when typing payee names

**Solutions:**

1. Check setting: `hledger.inlineCompletion.enabled` should be `true`
2. Type at least 2 characters (configurable via `hledger.inlineCompletion.minPayeeChars`)
3. Ensure payee exists in journal history (inline completions learn from existing transactions)
4. Check cursor position: Must be on new line after date, not inside existing transaction
5. Ensure not in snippet mode: Ghost text disabled during snippet editing (Tab navigation)

---

## Performance Issues

### Slow Performance with Large Files

**Symptoms:** Lag when editing, slow completions

**Solutions:**

1. Split large journal into monthly/yearly files:

   ```hledger
   include 2024-01.journal
   include 2024-02.journal
   ```

2. Increase cache: Extension caches parsed data automatically
3. Disable semantic highlighting for large files:

   ```json
   "hledger.semanticTokens.enabled": false
   ```

### High Memory Usage

**Symptoms:** VS Code uses excessive memory

**Solutions:**

1. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Check workspace size: Reduce number of included files
3. Restart VS Code completely

### Extension Activation Slow

**Symptoms:** Delay when opening hledger files

**Solutions:**

1. Check hledger PATH resolution (may scan slow file systems)
2. Set explicit path: `hledger.cli.path` in settings
3. Disable CLI integration if not needed
4. Note: Extension now has 5-second timeout protection to prevent hanging on slow file systems

---

## CLI Integration

### Commands Timing Out

**Symptoms:** "Failed to run hledger" errors

**Solutions:**

1. Verify hledger installed: `hledger --version` in terminal
2. Configure path explicitly:

   ```json
   "hledger.cli.path": "/usr/local/bin/hledger"
   ```

3. Check journal file size - large files take longer
4. Extension has 5-second timeout for PATH resolution - if timeout occurs frequently, set explicit path

### CLI Not Found

**Symptoms:** "hledger executable not found"

**Solutions:**

1. Install hledger: [Installation Guide](https://hledger.org/install.html)
2. Verify in PATH: Run `which hledger` (Unix) or `where hledger` (Windows)
3. Set custom path in settings: `hledger.cli.path`

### Wrong Journal File Used

**Symptoms:** Commands show data from wrong file

**Solutions:**
Resolution priority:

1. `LEDGER_FILE` environment variable (validated for security)
2. `hledger.cli.journalFile` setting (validated for security)
3. Current open file

Set explicitly in settings:

```json
"hledger.cli.journalFile": "/path/to/main.journal"
```

**Security Note:** Paths from environment variables and settings are validated to prevent command injection. Paths with shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `()`, `[]`, `{}`, `^`, `"`, `\`, `<`, `>`) are rejected.

### Progress Indicators

**Feature:** CLI commands now show progress notifications

When you run CLI commands (balance, stats, incomestatement), you'll see:

- "Running hledger balance..." notification appears
- Notification disappears when command completes
- Better visual feedback for potentially slow operations

---

## Syntax Highlighting

### No Colors / Plain Text

**Symptoms:** File appears black and white

**Solutions:**

1. Verify language mode: Click bottom-right → Select "hledger"
2. Check theme compatibility: Try different color theme
3. Enable semantic tokens:

   ```json
   "editor.semanticHighlighting.enabled": true
   ```

### Wrong Colors

**Symptoms:** Colors don't match expectation

**Solutions:**

1. Colors adapt to VS Code theme
2. Customize in settings:

   ```json
   "editor.tokenColorCustomizations": {
       "textMateRules": [
           {
               "scope": "keyword.operator.hledger",
               "settings": { "foreground": "#ff0000" }
           }
       ]
   }
   ```

### Highlighting Breaks

**Symptoms:** Colors incorrect after certain point

**Solutions:**

1. Syntax error in journal file
2. Reload window: `Ctrl+Shift+P` → "Reload Window"
3. Check for unclosed strings or directives

---

## Known Issues

### Unicode Characters

**Issue:** Some Unicode characters (Cyrillic, Asian) may display incorrectly in formatting

**Workaround:** Disable auto-formatting for affected files

### Multi-line Directives

**Issue:** Complex multi-line commodity directives may not parse correctly

**Status:** Known limitation, tracked in issue tracker

### Large Include Depth

**Issue:** More than 10 levels of include nesting not supported

**Workaround:** Flatten include hierarchy

**Security:** Include directives are validated to prevent path traversal attacks. Includes cannot escape workspace boundaries or access system directories.

---

## Getting Help

**Before Asking:**

1. Check this troubleshooting guide
2. Search [existing issues](https://github.com/juev/hledger-vscode/issues)
3. Try with minimal configuration (disable other extensions)

**When Reporting Issues:**
Include:

- VS Code version
- Extension version
- Operating system
- Sample journal file (minimal reproduction)
- Error messages from Output panel

**Support Channels:**

- [GitHub Issues](https://github.com/juev/hledger-vscode/issues) - Bug reports
- [GitHub Discussions](https://github.com/juev/hledger-vscode/discussions) - Questions
- [hledger Community](https://hledger.org/support.html) - General hledger help

---

**Last Updated:** 2025-01-24
