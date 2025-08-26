// ColorConfiguration.ts - Simple color configuration
// ~50 lines according to REFACTORING.md FASE G

import * as vscode from 'vscode';

// Enhanced color configuration interface with better type safety
/**
 * Type-safe interface defining all HLedger syntax highlighting colors.
 * Uses branded ColorValue type for compile-time validation.
 */
export interface HLedgerColors {
    readonly date: ColorValue;
    readonly account: ColorValue;
    readonly amount: ColorValue;
    readonly commodity: ColorValue;
    readonly payee: ColorValue;
    readonly comment: ColorValue;
    readonly tag: ColorValue;
    readonly directive: ColorValue;
}

// Branded type for color values with validation
/**
 * Branded type representing a validated color value.
 * Supports hex (#RGB, #RRGGBB), rgb(), and rgba() formats.
 */
export type ColorValue = string & { readonly __brand: 'ColorValue' };

// Type guard for color values
export const isValidColor = (value: string): value is ColorValue => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value) || 
           /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/.test(value) ||
           /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[01](?:\.\d+)?\)$/.test(value);
};

// Color value constructor with validation
export const createColorValue = (value: string): ColorValue => {
    if (!isValidColor(value)) {
        throw new Error(`Invalid color value: ${value}`);
    }
    return value as ColorValue;
};

// Default color values
export const DEFAULT_COLORS = {
    date: createColorValue('#2563EB'),
    account: createColorValue('#059669'),
    amount: createColorValue('#DC2626'),
    commodity: createColorValue('#7C3AED'),
    payee: createColorValue('#EA580C'),
    comment: createColorValue('#6B7280'),
    tag: createColorValue('#DB2777'),
    directive: createColorValue('#059669')
} as const satisfies HLedgerColors;

export function registerColorConfiguration(context: vscode.ExtensionContext): void {
    // Register command to apply custom colors
    const applyColorsCommand = vscode.commands.registerCommand('hledger.applyColors', async () => {
        const colors = getHLedgerColors();
        await applyColors(colors);
    });

    context.subscriptions.push(applyColorsCommand);

    // Register command to reset colors
    const resetColorsCommand = vscode.commands.registerCommand('hledger.resetColors', async () => {
        await resetColors();
    });

    context.subscriptions.push(resetColorsCommand);
}

export function getHLedgerColors(): HLedgerColors {
    const config = vscode.workspace.getConfiguration('hledger.colors');
    
    const getColorValue = (key: string, defaultValue: ColorValue): ColorValue => {
        const value = config.get<string>(key, defaultValue);
        try {
            return createColorValue(value);
        } catch {
            // Fallback to default if invalid color
            return defaultValue;
        }
    };
    
    return {
        date: getColorValue('date', DEFAULT_COLORS.date),
        account: getColorValue('account', DEFAULT_COLORS.account),
        amount: getColorValue('amount', DEFAULT_COLORS.amount),
        commodity: getColorValue('commodity', DEFAULT_COLORS.commodity),
        payee: getColorValue('payee', DEFAULT_COLORS.payee),
        comment: getColorValue('comment', DEFAULT_COLORS.comment),
        tag: getColorValue('tag', DEFAULT_COLORS.tag),
        directive: getColorValue('directive', DEFAULT_COLORS.directive)
    };
}

// Type-safe interfaces for VS Code token color customizations
interface TextMateRule {
    readonly scope: string | string[];
    readonly settings: {
        readonly foreground?: string;
        readonly background?: string;
        readonly fontStyle?: string;
    };
}

interface TokenColorCustomizations {
    readonly textMateRules?: TextMateRule[];
    readonly [key: string]: unknown;
}

export async function applyColors(colors: HLedgerColors): Promise<void> {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const currentCustomizations = editorConfig.get<TokenColorCustomizations>('tokenColorCustomizations') || {};
    
    const textMateRules: TextMateRule[] = [
        { scope: "constant.numeric.date.hledger", settings: { foreground: colors.date, fontStyle: "bold" }},
        { scope: "entity.name.function.account.hledger", settings: { foreground: colors.account }},
        { scope: "constant.numeric.amount.hledger", settings: { foreground: colors.amount, fontStyle: "bold" }},
        { scope: "entity.name.type.commodity.hledger", settings: { foreground: colors.commodity, fontStyle: "bold" }},
        { scope: "entity.name.tag.payee.hledger", settings: { foreground: colors.payee }},
        { scope: "comment.line.semicolon.hledger", settings: { foreground: colors.comment, fontStyle: "italic" }},
        { scope: "entity.name.tag.hledger", settings: { foreground: colors.tag, fontStyle: "bold" }},
        { scope: "keyword.directive.hledger", settings: { foreground: colors.directive, fontStyle: "bold" }}
    ];
    
    const existingRules = currentCustomizations.textMateRules || [];
    const nonHledgerRules = existingRules.filter((rule: TextMateRule) => 
        typeof rule.scope === 'string' 
            ? !rule.scope.includes('.hledger')
            : Array.isArray(rule.scope)
                ? !rule.scope.some(scope => scope.includes('.hledger'))
                : true
    );

    const updatedCustomizations: TokenColorCustomizations = {
        ...currentCustomizations,
        textMateRules: [
            // Keep existing non-hledger rules
            ...nonHledgerRules,
            // Add our hledger rules
            ...textMateRules
        ]
    };
    
    await editorConfig.update('tokenColorCustomizations', updatedCustomizations, vscode.ConfigurationTarget.Workspace);
}

export async function resetColors(): Promise<void> {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const currentCustomizations = editorConfig.get<TokenColorCustomizations>('tokenColorCustomizations') || {};
    
    const existingRules = currentCustomizations.textMateRules || [];
    const nonHledgerRules = existingRules.filter((rule: TextMateRule) => 
        typeof rule.scope === 'string' 
            ? !rule.scope.includes('.hledger')
            : Array.isArray(rule.scope)
                ? !rule.scope.some(scope => scope.includes('.hledger'))
                : true
    );
    
    const updatedCustomizations: TokenColorCustomizations = {
        ...currentCustomizations,
        textMateRules: nonHledgerRules
    };
    
    await editorConfig.update('tokenColorCustomizations', updatedCustomizations, vscode.ConfigurationTarget.Workspace);
}