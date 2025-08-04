import * as vscode from 'vscode';
import { IThemeService, IConfigService } from './interfaces';
import { ITextMateCustomizations, ITextMateRule } from '../core';

/**
 * Service for managing theme customization and TextMate rules
 * Implements Single Responsibility Principle by focusing only on theme management
 */
export class ThemeService implements IThemeService {
    private disposables: vscode.Disposable[] = [];

    constructor(private configService: IConfigService) {
        // Dependency injection - ConfigService is injected for testability
    }

    /**
     * Apply custom colors to the theme
     */
    public async applyCustomColors(): Promise<void> {
        try {
            const colors = this.getColorSettings();
            const textMateRules = this.createTextMateRules(colors);
            await this.updateTextMateCustomizations(textMateRules);
        } catch (error) {
            console.warn('HLedger ThemeService: Could not apply custom colors:', error);
        }
    }

    /**
     * Get current color settings
     */
    public getColorSettings(): {
        date: string;
        account: string;
        amount: string;
        commodity: string;
        payee: string;
        comment: string;
        tag: string;
        directive: string;
        accountDefined: string;
        accountVirtual: string;
    } {
        const hledgerConfig = this.configService.getSection('hledger.colors');
        
        return {
            date: hledgerConfig.get<string>('date', '#2563EB'),
            account: hledgerConfig.get<string>('account', '#059669'),
            amount: hledgerConfig.get<string>('amount', '#DC2626'),
            commodity: hledgerConfig.get<string>('commodity', '#7C3AED'),
            payee: hledgerConfig.get<string>('payee', '#EA580C'),
            comment: hledgerConfig.get<string>('comment', '#6B7280'),
            tag: hledgerConfig.get<string>('tag', '#DB2777'),
            directive: hledgerConfig.get<string>('directive', '#059669'),
            accountDefined: hledgerConfig.get<string>('accountDefined', '#0891B2'),
            accountVirtual: hledgerConfig.get<string>('accountVirtual', '#6B7280'),
        };
    }

    /**
     * Register color application command
     */
    public registerApplyColorsCommand(context: vscode.ExtensionContext): void {
        const applyColorsCommand = vscode.commands.registerCommand('hledger.applyColors', async () => {
            await this.applyCustomColors();
            vscode.window.showInformationMessage('HLedger: Applied custom colors');
        });
        
        context.subscriptions.push(applyColorsCommand);
        this.disposables.push(applyColorsCommand);
    }

    /**
     * Create TextMate rules for syntax highlighting
     */
    private createTextMateRules(colors: any): ITextMateRule[] {
        return [
            // Date styles
            {
                "scope": "constant.numeric.date.hledger",
                "settings": { 
                    "foreground": colors.date,
                    "fontStyle": "bold"
                }
            },
            // Account styles
            {
                "scope": "entity.name.function.account.hledger",
                "settings": { 
                    "foreground": colors.account
                }
            },
            {
                "scope": "entity.name.function.account.defined.hledger",
                "settings": { 
                    "foreground": colors.accountDefined,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "entity.name.function.account.virtual.hledger",
                "settings": { 
                    "foreground": colors.accountVirtual,
                    "fontStyle": "italic"
                }
            },
            // Special account types
            {
                "scope": "entity.name.function.account.asset.hledger",
                "settings": { 
                    "foreground": colors.account
                }
            },
            {
                "scope": "entity.name.function.account.liability.hledger",
                "settings": { 
                    "foreground": colors.account
                }
            },
            {
                "scope": "entity.name.function.account.equity.hledger",
                "settings": { 
                    "foreground": colors.account
                }
            },
            {
                "scope": "entity.name.function.account.income.hledger",
                "settings": { 
                    "foreground": colors.account
                }
            },
            {
                "scope": "entity.name.function.account.expense.hledger",
                "settings": { 
                    "foreground": colors.account
                }
            },
            // Amount styles
            {
                "scope": "constant.numeric.amount.hledger",
                "settings": { 
                    "foreground": colors.amount,
                    "fontStyle": "bold"
                }
            },
            // Commodity styles
            {
                "scope": "entity.name.type.commodity.hledger",
                "settings": { 
                    "foreground": colors.commodity,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "entity.name.type.commodity.defined.hledger",
                "settings": { 
                    "foreground": colors.commodity,
                    "fontStyle": "bold"
                }
            },
            {
                "scope": "entity.name.type.commodity.quoted.hledger",
                "settings": { 
                    "foreground": colors.commodity,
                    "fontStyle": "bold"
                }
            },
            // Payee styles
            {
                "scope": "entity.name.tag.payee.hledger",
                "settings": { 
                    "foreground": colors.payee
                }
            },
            // Comment styles
            {
                "scope": "comment.line.semicolon.hledger",
                "settings": { 
                    "foreground": colors.comment,
                    "fontStyle": "italic"
                }
            },
            {
                "scope": "comment.line.number-sign.hledger",
                "settings": { 
                    "foreground": colors.comment,
                    "fontStyle": "italic"
                }
            },
            // Tag styles
            {
                "scope": "entity.name.tag.hledger",
                "settings": { 
                    "foreground": colors.tag,
                    "fontStyle": "bold"
                }
            },
            // Directive styles
            {
                "scope": "keyword.directive.hledger",
                "settings": { 
                    "foreground": colors.directive,
                    "fontStyle": "bold"
                }
            },
            // Operator styles
            {
                "scope": "keyword.operator",
                "settings": { 
                    "foreground": colors.directive
                }
            }
        ];
    }

    /**
     * Update TextMate customizations in workspace settings
     */
    private async updateTextMateCustomizations(textMateRules: ITextMateRule[]): Promise<void> {
        const editorConfig = this.configService.getSection('editor');
        const currentTextMateCustomizations = editorConfig.get('tokenColorCustomizations') || {};
        
        const updatedTextMateCustomizations: ITextMateCustomizations = {
            ...currentTextMateCustomizations,
            "[*]": {
                ...((currentTextMateCustomizations as ITextMateCustomizations)["[*]"] || {}),
                "textMateRules": [
                    // Keep existing non-hledger rules
                    ...((currentTextMateCustomizations as ITextMateCustomizations)["[*]"]?.textMateRules || []).filter((rule: ITextMateRule) => 
                        !rule.scope?.includes('.hledger')
                    ),
                    // Add our hledger rules
                    ...textMateRules
                ]
            }
        };
        
        // Apply to workspace settings only (not global)
        await editorConfig.update('tokenColorCustomizations', updatedTextMateCustomizations, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        // Dispose all tracked disposables
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.warn('ThemeService: Error disposing resource:', error);
            }
        }
        
        this.disposables = [];
    }
}