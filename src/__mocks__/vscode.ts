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
    TriggerForIncompleteCompletions = 2
}

export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

export interface CompletionContext {
    triggerKind: CompletionTriggerKind;
    triggerCharacter?: string;
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

export class Range {
    start: Position;
    end: Position;

    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
    constructor(start: Position, end: Position);
    constructor(startOrStartLine: Position | number, startCharacterOrEnd?: Position | number, endLine?: number, endCharacter?: number) {
        if (typeof startOrStartLine === 'number') {
            this.start = new Position(startOrStartLine, startCharacterOrEnd as number);
            this.end = new Position(endLine!, endCharacter!);
        } else {
            this.start = startOrStartLine;
            this.end = startCharacterOrEnd as Position;
        }
    }
}

export class Position {
    line: number;
    character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
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
    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;
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
export const createMockExtensionContext = (overrides: Partial<ExtensionContext> = {}): ExtensionContext => ({
    subscriptions: [],
    workspaceState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) },
    globalState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) },
    secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn() },
    extensionUri: Uri.file('/test/extension'),
    extensionPath: '/test/extension',
    environmentVariableCollection: { replace: jest.fn(), append: jest.fn(), prepend: jest.fn() },
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
    ...overrides
});

export const workspace = {
    getWorkspaceFolder: jest.fn(),
    onDidOpenTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    workspaceFolders: [] as WorkspaceFolder[],
    fs: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
    },
    getConfiguration: jest.fn()
};

export const languages = {
    registerCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() }))
};

export const window = {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
};

export const commands = {
    registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
};

export class SemanticTokensLegend {
    tokenTypes: readonly string[];
    tokenModifiers: readonly string[];

    constructor(tokenTypes: readonly string[], tokenModifiers: readonly string[] = []) {
        this.tokenTypes = tokenTypes;
        this.tokenModifiers = tokenModifiers;
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

export const Uri = {
    file: (path: string) => ({
        scheme: 'file',
        authority: '',
        path,
        query: '',
        fragment: '',
        fsPath: path,
        with: jest.fn(),
        toString: () => `file://${path}`,
        toJSON: () => ({ $mid: 1, fsPath: path, path, scheme: 'file' })
    }),
    parse: jest.fn()
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
            isEmptyOrWhitespace: lineText.trim() === ''
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