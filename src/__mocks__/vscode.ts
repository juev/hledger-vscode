/**
 * Thenable type for Promise-like objects.
 */
export type Thenable<T> =
  | Promise<T>
  | {
      then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | Thenable<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | Thenable<TResult2>) | null
      ): Thenable<TResult1 | TResult2>;
    };

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  Reference = 17,
  File = 16,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
  User = 25,
  Issue = 26,
}

export enum CompletionTriggerKind {
  Invoke = 0,
  TriggerCharacter = 1,
  TriggerForIncompleteCompletions = 2,
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export enum CodeActionTriggerKind {
  Invoke = 1,
  Automatic = 2,
}

export class CodeActionKind {
  static readonly Empty = new CodeActionKind('');
  static readonly QuickFix = new CodeActionKind('quickfix');
  static readonly Refactor = new CodeActionKind('refactor');
  static readonly RefactorExtract = new CodeActionKind('refactor.extract');
  static readonly RefactorInline = new CodeActionKind('refactor.inline');
  static readonly RefactorRewrite = new CodeActionKind('refactor.rewrite');
  static readonly Source = new CodeActionKind('source');
  static readonly SourceOrganizeImports = new CodeActionKind('source.organizeImports');
  static readonly SourceFixAll = new CodeActionKind('source.fixAll');

  private constructor(public readonly value: string) {}
}

export interface CompletionContext {
  triggerKind: CompletionTriggerKind;
  triggerCharacter?: string;
}

export interface CodeActionContext {
  diagnostics: any[];
  only?: CodeActionKind;
  triggerKind: CodeActionTriggerKind;
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: any;
}

export class CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: string;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  range?: Range;

  constructor(label: string, kind?: CompletionItemKind) {
    this.label = label;
    if (kind !== undefined) {
      this.kind = kind;
    }
  }
}

export class CompletionList {
  items: CompletionItem[];
  isIncomplete: boolean;

  constructor(items?: CompletionItem[], isIncomplete?: boolean) {
    this.items = items || [];
    this.isIncomplete = isIncomplete || false;
  }
}

export class Diagnostic {
  range: Range;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string | number;
  relatedInformation?: any[];

  constructor(range: Range, message: string, severity: DiagnosticSeverity) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}

export class CodeAction {
  title: string;
  kind?: CodeActionKind;
  edit?: WorkspaceEdit;
  diagnostics?: any[];
  command?: any;
  isPreferred?: boolean;
  disabled?: { reason: string };

  constructor(title: string, kind?: CodeActionKind) {
    this.title = title;
    if (kind !== undefined) {
      this.kind = kind;
    }
  }
}

export interface CodeActionProvider {
  provideCodeActions(
    document: TextDocument,
    range: Range | Selection,
    context: CodeActionContext,
    token: CancellationToken
  ): CodeAction[] | undefined | null | Promise<CodeAction[] | undefined | null>;
}

export class WorkspaceEdit {
  private _edits: Map<string, Array<{ range: Range; newText: string }>> = new Map();

  insert(uri: Uri, position: Position, newText: string): void {
    const key = uri.toString();
    if (!this._edits.has(key)) {
      this._edits.set(key, []);
    }
    this._edits.get(key)!.push({
      range: new Range(position, position),
      newText,
    });
  }

  replace(uri: Uri, range: Range, newText: string): void {
    const key = uri.toString();
    if (!this._edits.has(key)) {
      this._edits.set(key, []);
    }
    this._edits.get(key)!.push({ range, newText });
  }

  delete(uri: Uri, range: Range): void {
    this.replace(uri, range, '');
  }

  get(uri: Uri): Array<{ range: Range; newText: string }> | undefined {
    return this._edits.get(uri.toString());
  }
}

export class Range {
  start: Position;
  end: Position;

  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  constructor(start: Position, end: Position);
  constructor(
    startOrStartLine: Position | number,
    startCharacterOrEnd?: Position | number,
    endLine?: number,
    endCharacter?: number
  ) {
    if (typeof startOrStartLine === 'number') {
      this.start = new Position(startOrStartLine, startCharacterOrEnd as number);
      this.end = new Position(endLine!, endCharacter!);
    } else {
      this.start = startOrStartLine;
      this.end = startCharacterOrEnd as Position;
    }
  }

  get isEmpty(): boolean {
    return this.start.line === this.end.line && this.start.character === this.end.character;
  }

  get isSingleLine(): boolean {
    return this.start.line === this.end.line;
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Range) {
      return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }
    return (
      positionOrRange.line >= this.start.line &&
      positionOrRange.line <= this.end.line &&
      (positionOrRange.line !== this.start.line ||
        positionOrRange.character >= this.start.character) &&
      (positionOrRange.line !== this.end.line || positionOrRange.character <= this.end.character)
    );
  }

  isEqual(other: Range): boolean {
    return (
      this.start.line === other.start.line &&
      this.start.character === other.start.character &&
      this.end.line === other.end.line &&
      this.end.character === other.end.character
    );
  }

  intersection(other: Range): Range | undefined {
    const start =
      this.start.line > other.start.line
        ? this.start
        : this.start.line < other.start.line
          ? other.start
          : this.start.character > other.start.character
            ? this.start
            : other.start;
    const end =
      this.end.line < other.end.line
        ? this.end
        : this.end.line > other.end.line
          ? other.end
          : this.end.character < other.end.character
            ? this.end
            : other.end;

    if (start.line > end.line || (start.line === end.line && start.character > end.character)) {
      return undefined;
    }
    return new Range(start, end);
  }

  union(other: Range): Range {
    const start =
      this.start.line < other.start.line
        ? this.start
        : this.start.line > other.start.line
          ? other.start
          : this.start.character < other.start.character
            ? this.start
            : other.start;
    const end =
      this.end.line > other.end.line
        ? this.end
        : this.end.line < other.end.line
          ? other.end
          : this.end.character > other.end.character
            ? this.end
            : other.end;
    return new Range(start, end);
  }

  with(change: { start?: Position; end?: Position }): Range;
  with(start?: Position, end?: Position): Range;
  with(startOrChange?: Position | { start?: Position; end?: Position }, end?: Position): Range {
    if (startOrChange && typeof startOrChange === 'object' && 'start' in startOrChange) {
      const change = startOrChange as { start?: Position; end?: Position };
      return new Range(change.start || this.start, change.end || this.end);
    }
    return new Range((startOrChange as Position) || this.start, end || this.end);
  }
}

export class Position {
  line: number;
  character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  isBefore(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isBeforeOrEqual(other: Position): boolean {
    return (
      this.line < other.line || (this.line === other.line && this.character <= other.character)
    );
  }

  isAfter(other: Position): boolean {
    return this.line > other.line || (this.line === other.line && this.character > other.character);
  }

  isAfterOrEqual(other: Position): boolean {
    return (
      this.line > other.line || (this.line === other.line && this.character >= other.character)
    );
  }

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  compareTo(other: Position): number {
    if (this.line < other.line) return -1;
    if (this.line > other.line) return 1;
    if (this.character < other.character) return -1;
    if (this.character > other.character) return 1;
    return 0;
  }

  translate(lineDelta?: number, characterDelta?: number): Position;
  translate(change: { lineDelta?: number; characterDelta?: number }): Position;
  translate(
    lineDeltaOrChange?: number | { lineDelta?: number; characterDelta?: number },
    characterDelta?: number
  ): Position {
    if (typeof lineDeltaOrChange === 'object') {
      const change = lineDeltaOrChange as {
        lineDelta?: number;
        characterDelta?: number;
      };
      return new Position(
        this.line + (change.lineDelta || 0),
        this.character + (change.characterDelta || 0)
      );
    }
    return new Position(
      this.line + (lineDeltaOrChange || 0),
      this.character + (characterDelta || 0)
    );
  }

  with(line?: number, character?: number): Position;
  with(change: { line?: number; character?: number }): Position;
  with(
    lineOrChange?: number | { line?: number; character?: number },
    character?: number
  ): Position {
    if (typeof lineOrChange === 'object') {
      const change = lineOrChange as { line?: number; character?: number };
      return new Position(
        change.line !== undefined ? change.line : this.line,
        change.character !== undefined ? change.character : this.character
      );
    }
    return new Position(
      lineOrChange !== undefined ? lineOrChange : this.line,
      character !== undefined ? character : this.character
    );
  }
}

export class Selection extends Range {
  anchor: Position;
  active: Position;

  constructor(
    anchorLine: number,
    anchorCharacter: number,
    activeLine: number,
    activeCharacter: number
  );
  constructor(anchor: Position, active: Position);
  constructor(
    anchorOrLine: Position | number,
    anchorCharacterOrActive?: Position | number,
    activeLine?: number,
    activeCharacter?: number
  ) {
    if (typeof anchorOrLine === 'number') {
      super(anchorOrLine, anchorCharacterOrActive as number, activeLine!, activeCharacter!);
      this.anchor = new Position(anchorOrLine, anchorCharacterOrActive as number);
      this.active = new Position(activeLine!, activeCharacter!);
    } else {
      super(anchorOrLine, anchorCharacterOrActive as Position);
      this.anchor = anchorOrLine;
      this.active = anchorCharacterOrActive as Position;
    }
  }

  get isReversed(): boolean {
    return this.active.isBefore(this.anchor);
  }
}

/**
 * Mock TextDocument interface for VS Code API compatibility.
 * Provides type-safe document operations for testing.
 */
export interface TextDocument {
  readonly uri: Uri;
  readonly fileName: string;
  readonly languageId: string;
  readonly version: number;
  readonly isDirty: boolean;
  readonly isClosed: boolean;
  readonly isUntitled: boolean;
  readonly lineCount: number;
  readonly eol: EndOfLine;
  readonly encoding: string;
  save(): Thenable<boolean>;
  getText(): string;
  getText(range: Range): string;
  lineAt(line: number): TextLine;
  lineAt(position: Position): TextLine;
  offsetAt(position: Position): number;
  positionAt(offset: number): Position;
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
  validateRange(range: Range): Range;
  validatePosition(position: Position): Position;
}

export interface TextLine {
  lineNumber: number;
  text: string;
  range: Range;
  rangeIncludingLineBreak: Range;
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
}

export interface Uri {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  fsPath: string;
  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri;
  toString(skipEncoding?: boolean): string;
  toJSON(): Record<string, unknown>;
}

export interface WorkspaceFolder {
  uri: Uri;
  name: string;
  index: number;
}

export interface Disposable {
  dispose(): void;
}

export class Disposable {
  constructor(private disposeFunction?: () => void) {}

  dispose(): void {
    if (this.disposeFunction) {
      this.disposeFunction();
    }
  }
}

/**
 * Storage interface for workspace/global state.
 */
interface ExtensionStorage {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
  keys(): readonly string[];
}

/**
 * Environment variable collection interface.
 */
interface EnvironmentVariableCollection {
  replace(variable: string, value: string): void;
  append(variable: string, value: string): void;
  prepend(variable: string, value: string): void;
}

/**
 * Extension secrets interface.
 */
interface ExtensionSecrets {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
}

/**
 * Language model access information interface.
 */
interface LanguageModelAccessInformation {
  canSendRequest(): boolean;
}

/**
 * Extension information interface.
 */
interface ExtensionInfo {
  readonly id: string;
  readonly packageJSON: Record<string, unknown>;
}

/**
 * Mock ExtensionContext interface for VS Code API compatibility.
 * Provides type-safe extension context operations for testing.
 */
export interface ExtensionContext {
  subscriptions: Disposable[];
  workspaceState: ExtensionStorage;
  globalState: ExtensionStorage;
  secrets: ExtensionSecrets;
  extensionUri: Uri;
  extensionPath: string;
  environmentVariableCollection: EnvironmentVariableCollection;
  storagePath?: string;
  globalStoragePath: string;
  logPath: string;
  logUri: Uri;
  storageUri?: Uri;
  globalStorageUri: Uri;
  asAbsolutePath(relativePath: string): string;
  extension: ExtensionInfo;
  extensionMode: number; // ExtensionMode enum
  languageModelAccessInformation: LanguageModelAccessInformation;
}

// Mock ExtensionContext implementation for tests
export const createMockExtensionContext = (
  overrides: Partial<ExtensionContext> = {}
): ExtensionContext => ({
  subscriptions: [],
  workspaceState: {
    get: jest.fn(),
    update: jest.fn(),
    keys: jest.fn(() => []),
  },
  globalState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) },
  secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn() },
  extensionUri: Uri.file('/test/extension'),
  extensionPath: '/test/extension',
  environmentVariableCollection: {
    replace: jest.fn(),
    append: jest.fn(),
    prepend: jest.fn(),
  },
  storagePath: '/test/storage',
  globalStoragePath: '/test/global-storage',
  logPath: '/test/logs',
  logUri: Uri.file('/test/logs'),
  storageUri: Uri.file('/test/storage'),
  globalStorageUri: Uri.file('/test/global-storage'),
  asAbsolutePath: (relativePath: string) => `/test/extension/${relativePath}`,
  extension: { id: 'test.extension', packageJSON: {} },
  extensionMode: 1, // Normal extension mode
  languageModelAccessInformation: { canSendRequest: jest.fn() },
  ...overrides,
});

export const workspace = {
  getWorkspaceFolder: jest.fn((uri) => {
    // Return a mock workspace folder for test documents
    if (uri && uri.fsPath && uri.fsPath.startsWith('/test')) {
      return {
        uri: {
          scheme: 'file',
          authority: '',
          path: '/test',
          query: '',
          fragment: '',
          fsPath: '/test',
          with: jest.fn(),
          toString: () => 'file:///test',
          toJSON: () => ({
            $mid: 1,
            fsPath: '/test',
            path: '/test',
            scheme: 'file',
          }),
        },
        name: 'test-workspace',
        index: 0,
      };
    }
    return undefined;
  }),
  onDidOpenTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
  workspaceFolders: [
    {
      uri: {
        scheme: 'file',
        authority: '',
        path: '/test',
        query: '',
        fragment: '',
        fsPath: '/test',
        with: jest.fn(),
        toString: () => 'file:///test',
        toJSON: () => ({
          $mid: 1,
          fsPath: '/test',
          path: '/test',
          scheme: 'file',
        }),
      },
      name: 'test-workspace',
      index: 0,
    },
  ] as WorkspaceFolder[],
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  getConfiguration: jest.fn(() => ({
    get: jest.fn((key: string, defaultValue?: unknown) => {
      // Return default value for boolean settings
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return '';
    }),
    update: jest.fn(),
    has: jest.fn(() => false),
    inspect: jest.fn(),
  })),
};

export interface DiagnosticCollection extends Disposable {
  name: string;
  set(uri: Uri, diagnostics: Diagnostic[] | undefined): void;
  delete(uri: Uri): void;
  clear(): void;
  forEach(
    callback: (uri: Uri, diagnostics: Diagnostic[], collection: DiagnosticCollection) => void,
    thisArg?: any
  ): void;
  get(uri: Uri): Diagnostic[] | undefined;
  has(uri: Uri): boolean;
}

class MockDiagnosticCollection implements DiagnosticCollection {
  private diagnostics: Map<string, Diagnostic[]> = new Map();

  constructor(public name: string) {}

  set(uri: Uri, diagnostics: Diagnostic[] | undefined): void {
    const key = uri.toString();
    if (diagnostics === undefined || diagnostics.length === 0) {
      this.diagnostics.delete(key);
    } else {
      this.diagnostics.set(key, diagnostics);
    }
  }

  delete(uri: Uri): void {
    this.diagnostics.delete(uri.toString());
  }

  clear(): void {
    this.diagnostics.clear();
  }

  forEach(
    callback: (uri: Uri, diagnostics: Diagnostic[], collection: DiagnosticCollection) => void,
    thisArg?: any
  ): void {
    this.diagnostics.forEach((diagnostics, uriString) => {
      const uri = Uri.parse(uriString);
      callback.call(thisArg, uri, diagnostics, this);
    });
  }

  get(uri: Uri): Diagnostic[] | undefined {
    return this.diagnostics.get(uri.toString());
  }

  has(uri: Uri): boolean {
    return this.diagnostics.has(uri.toString());
  }

  dispose(): void {
    this.clear();
  }
}

export const languages = {
  registerCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() })),
  registerDocumentSemanticTokensProvider: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  registerDocumentRangeSemanticTokensProvider: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  registerCodeActionsProvider: jest.fn(() => ({ dispose: jest.fn() })),
  registerInlineCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() })),
  createDiagnosticCollection: jest.fn(
    (name: string): DiagnosticCollection => new MockDiagnosticCollection(name)
  ),
};

export interface OutputChannel {
  name: string;
  append(value: string): void;
  appendLine(value: string): void;
  clear(): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  setStatusBarMessage: jest.fn(),
  activeTextEditor: {
    document: null,
    edit: jest.fn(),
  },
  withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
  createOutputChannel: jest.fn(
    (name: string): OutputChannel => ({
      name,
      append: jest.fn(),
      appendLine: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })
  ),
};

export const commands = {
  registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
};

export class SemanticTokensLegend {
  tokenTypes: readonly string[];
  tokenModifiers: readonly string[];

  constructor(tokenTypes: readonly string[], tokenModifiers: readonly string[] = []) {
    this.tokenTypes = tokenTypes;
    this.tokenModifiers = tokenModifiers;
  }
}

export class SemanticTokensBuilder {
  private _legend: SemanticTokensLegend;
  private _tokens: Array<{
    line: number;
    char: number;
    length: number;
    type: number;
    mods: number;
  }>;
  constructor(legend: SemanticTokensLegend) {
    this._legend = legend;
    this._tokens = [];
  }
  push(
    line: number,
    char: number,
    length: number,
    tokenTypeIndex: number,
    tokenModifierSet: number = 0
  ) {
    this._tokens.push({
      line,
      char,
      length,
      type: tokenTypeIndex,
      mods: tokenModifierSet,
    });
  }
  build(): any {
    return { data: this._tokens } as any;
  }
}

export class MarkdownString {
  value: string;
  isTrusted?: boolean;
  supportThemeIcons?: boolean;
  uris?: { [id: string]: Uri };

  constructor(value?: string, supportThemeIcons?: boolean) {
    this.value = value || '';
    if (supportThemeIcons !== undefined) {
      this.supportThemeIcons = supportThemeIcons;
    }
  }

  appendText(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendCodeblock(value: string, language?: string): MarkdownString {
    this.value += '```' + (language || '') + '\n' + value + '\n```\n';
    return this;
  }
}

export class SnippetString {
  value: string;

  constructor(value?: string) {
    this.value = value || '';
  }

  appendText(value: string): SnippetString {
    this.value += value;
    return this;
  }

  appendTabstop(number?: number): SnippetString {
    this.value += number !== undefined ? `\$${number}` : '$0';
    return this;
  }

  appendPlaceholder(
    value: string | ((snippet: SnippetString) => void),
    number?: number
  ): SnippetString {
    if (typeof value === 'function') {
      const inner = new SnippetString();
      value(inner);
      this.value += `\${${number || 1}:${inner.value}}`;
    } else {
      this.value += `\${${number || 1}:${value}}`;
    }
    return this;
  }

  appendChoice(values: string[], number?: number): SnippetString {
    this.value += `\${${number || 1}|${values.join(',')}|}`;
    return this;
  }

  appendVariable(
    name: string,
    defaultValue?: string | ((snippet: SnippetString) => void)
  ): SnippetString {
    if (defaultValue !== undefined) {
      if (typeof defaultValue === 'function') {
        const inner = new SnippetString();
        defaultValue(inner);
        this.value += `\${${name}:${inner.value}}`;
      } else {
        this.value += `\${${name}:${defaultValue}}`;
      }
    } else {
      this.value += `\$${name}`;
    }
    return this;
  }
}

const createUriObject = (path: string): Uri => ({
  scheme: 'file',
  authority: '',
  path,
  query: '',
  fragment: '',
  fsPath: path,
  with: jest.fn(),
  toString: () => `file://${path}`,
  toJSON: () => ({ $mid: 1, fsPath: path, path, scheme: 'file' }),
});

export const Uri = {
  file: createUriObject,
  parse: jest.fn(),
};

/**
 * Mock TextDocument implementation for testing.
 * Provides full compatibility with VS Code TextDocument interface.
 */
export class MockTextDocument implements TextDocument {
  readonly uri: Uri;
  readonly fileName: string;
  readonly languageId: string;
  readonly version: number;
  readonly isDirty: boolean;
  readonly isClosed: boolean;
  readonly isUntitled: boolean;
  readonly lineCount: number;
  readonly eol: EndOfLine;
  readonly encoding: string;

  constructor(
    private lines: string[],
    options: Partial<{
      uri: Uri;
      fileName: string;
      languageId: string;
      version: number;
      isDirty: boolean;
      isClosed: boolean;
      isUntitled: boolean;
      eol: EndOfLine;
      encoding: string;
    }> = {}
  ) {
    this.uri = options.uri || Uri.file('/test/document.txt');
    this.fileName = options.fileName || '/test/document.txt';
    this.languageId = options.languageId || 'hledger';
    this.version = options.version || 1;
    this.isDirty = options.isDirty || false;
    this.isClosed = options.isClosed || false;
    this.isUntitled = options.isUntitled || false;
    this.lineCount = this.lines.length;
    this.eol = options.eol || EndOfLine.LF;
    this.encoding = options.encoding || 'utf8';
  }

  save(): Thenable<boolean> {
    return Promise.resolve(true);
  }

  getText(): string;
  getText(range: Range): string;
  getText(range?: Range): string {
    if (!range) {
      return this.lines.join('\n');
    }

    const startLine = Math.max(0, Math.min(range.start.line, this.lines.length - 1));
    const endLine = Math.max(0, Math.min(range.end.line, this.lines.length - 1));

    if (startLine === endLine) {
      const line = this.lines[startLine] || '';
      const startChar = Math.max(0, Math.min(range.start.character, line.length));
      const endChar = Math.max(startChar, Math.min(range.end.character, line.length));
      return line.substring(startChar, endChar);
    }

    const result: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      const line = this.lines[i] || '';
      if (i === startLine) {
        const startChar = Math.max(0, Math.min(range.start.character, line.length));
        result.push(line.substring(startChar));
      } else if (i === endLine) {
        const endChar = Math.max(0, Math.min(range.end.character, line.length));
        result.push(line.substring(0, endChar));
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  lineAt(line: number): TextLine;
  lineAt(position: Position): TextLine;
  lineAt(lineOrPosition: number | Position): TextLine {
    const lineNumber = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
    const lineText = this.lines[lineNumber] || '';

    return {
      lineNumber,
      text: lineText,
      range: new Range(lineNumber, 0, lineNumber, lineText.length),
      rangeIncludingLineBreak: new Range(lineNumber, 0, lineNumber + 1, 0),
      firstNonWhitespaceCharacterIndex: lineText.search(/\S/),
      isEmptyOrWhitespace: lineText.trim() === '',
    };
  }

  offsetAt(position: Position): number {
    let offset = 0;
    for (let i = 0; i < Math.min(position.line, this.lines.length); i++) {
      offset += (this.lines[i] || '').length + 1; // +1 for line break
    }
    if (position.line < this.lines.length) {
      const line = this.lines[position.line] || '';
      offset += Math.min(position.character, line.length);
    }
    return offset;
  }

  positionAt(offset: number): Position {
    let currentOffset = 0;
    for (let line = 0; line < this.lines.length; line++) {
      const lineText = this.lines[line] || '';
      if (currentOffset + lineText.length >= offset) {
        return new Position(line, offset - currentOffset);
      }
      currentOffset += lineText.length + 1; // +1 for line break
    }
    // If offset is beyond document, return end position
    const lastLine = Math.max(0, this.lines.length - 1);
    const lastLineText = this.lines[lastLine] || '';
    return new Position(lastLine, lastLineText.length);
  }

  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined {
    const line = this.lines[position.line];
    if (!line) return undefined;

    const wordRegex = regex || /[-?\.:a-zA-Z0-9_\s]+/;
    const matches = Array.from(line.matchAll(new RegExp(wordRegex, 'g')));

    for (const match of matches) {
      if (match.index !== undefined) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new Range(position.line, start, position.line, end);
        }
      }
    }

    return undefined;
  }

  validateRange(range: Range): Range {
    const startLine = Math.max(0, Math.min(range.start.line, this.lines.length - 1));
    const endLine = Math.max(startLine, Math.min(range.end.line, this.lines.length - 1));

    const startLineText = this.lines[startLine] || '';
    const endLineText = this.lines[endLine] || '';

    const startChar = Math.max(0, Math.min(range.start.character, startLineText.length));
    const endChar = Math.max(0, Math.min(range.end.character, endLineText.length));

    return new Range(startLine, startChar, endLine, endChar);
  }

  validatePosition(position: Position): Position {
    const line = Math.max(0, Math.min(position.line, this.lines.length - 1));
    const lineText = this.lines[line] || '';
    const character = Math.max(0, Math.min(position.character, lineText.length));

    return new Position(line, character);
  }
}

/**
 * Inline completion trigger kind enum.
 */
export enum InlineCompletionTriggerKind {
  Invoke = 0,
  Automatic = 1,
}

/**
 * Inline completion context interface.
 */
export interface InlineCompletionContext {
  triggerKind: InlineCompletionTriggerKind;
  selectedCompletionInfo?: {
    range: Range;
    text: string;
  };
}

/**
 * Mock InlineCompletionItem class for inline ghost text completions.
 */
export class InlineCompletionItem {
  insertText: string | SnippetString;
  range: Range | undefined;
  command?: unknown;
  filterText?: string;

  constructor(insertText: string | SnippetString, range?: Range) {
    this.insertText = insertText;
    this.range = range;
  }
}

// Export vscode module as both named exports and default export for compatibility
export default {
  Uri,
  workspace,
  window,
  commands,
  languages,
  DiagnosticSeverity,
  CodeActionKind,
  CompletionItemKind,
  CompletionTriggerKind,
  ConfigurationTarget,
  EndOfLine,
  ProgressLocation,
  CodeActionTriggerKind,
  Range,
  Position,
  Selection,
  Diagnostic,
  CodeAction,
  CompletionItem,
  CompletionList,
  WorkspaceEdit,
  SemanticTokensLegend,
  SemanticTokensBuilder,
  MarkdownString,
  SnippetString,
  Disposable,
  createMockExtensionContext,
  MockTextDocument,
  InlineCompletionItem,
  InlineCompletionTriggerKind,
};
