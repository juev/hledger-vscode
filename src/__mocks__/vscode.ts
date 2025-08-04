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
        this.kind = kind;
    }
}

export class Range {
    start: Position;
    end: Position;

    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
    constructor(start: Position, end: Position);
    constructor(startOrStartLine: any, startCharacterOrEnd?: any, endLine?: number, endCharacter?: number) {
        if (typeof startOrStartLine === 'number') {
            this.start = new Position(startOrStartLine, startCharacterOrEnd);
            this.end = new Position(endLine!, endCharacter!);
        } else {
            this.start = startOrStartLine;
            this.end = startCharacterOrEnd;
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

export interface TextDocument {
    uri: Uri;
    fileName: string;
    languageId: string;
    version: number;
    isDirty: boolean;
    isClosed: boolean;
    isUntitled: boolean;
    lineCount: number;
    getText(): string;
    getText(range: Range): string;
    lineAt(line: number): TextLine;
    lineAt(position: Position): TextLine;
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
    toJSON(): any;
}

export interface WorkspaceFolder {
    uri: Uri;
    name: string;
    index: number;
}

export interface Disposable {
    dispose(): void;
}

export interface ExtensionContext {
    subscriptions: Disposable[];
    workspaceState: any;
    globalState: any;
    secrets: any;
    extensionUri: Uri;
    extensionPath: string;
    environmentVariableCollection: any;
    storagePath?: string;
    globalStoragePath: string;
    logPath: string;
    logUri: Uri;
    storageUri?: Uri;
    globalStorageUri: Uri;
    asAbsolutePath(relativePath: string): string;
    extension: any;
    extensionMode: any;
    languageModelAccessInformation: any;
}

// Mock ExtensionContext implementation for tests
export const createMockExtensionContext = (overrides: Partial<ExtensionContext> = {}): ExtensionContext => ({
    subscriptions: [],
    workspaceState: { get: jest.fn(), update: jest.fn() },
    globalState: { get: jest.fn(), update: jest.fn() },
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
    extension: { id: 'test.extension' },
    extensionMode: 1, // Normal extension mode
    languageModelAccessInformation: { canSendRequest: jest.fn() },
    ...overrides
});

export const workspace = {
    getWorkspaceFolder: jest.fn(),
    onDidOpenTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    workspaceFolders: [],
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