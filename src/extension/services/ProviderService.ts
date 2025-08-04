import * as vscode from 'vscode';
import { IProviderService, IConfigService } from './interfaces';
import { HLedgerEnterCommand } from '../indentProvider';
import { KeywordCompletionProvider as NewKeywordCompletionProvider } from '../completion/providers/KeywordCompletionProvider';
import { AccountCompletionProvider as NewAccountCompletionProvider } from '../completion/providers/AccountCompletionProvider';
import { CommodityCompletionProvider as NewCommodityCompletionProvider } from '../completion/providers/CommodityCompletionProvider';
import { DateCompletionProvider as NewDateCompletionProvider } from '../completion/providers/DateCompletionProvider';
import { PayeeCompletionProvider as NewPayeeCompletionProvider } from '../completion/providers/PayeeCompletionProvider';
import { TagCompletionProvider as NewTagCompletionProvider } from '../completion/providers/TagCompletionProvider';

/**
 * Service for managing completion provider registration and management
 * Implements Single Responsibility Principle by focusing only on provider management
 */
export class ProviderService implements IProviderService {
    private disposables: vscode.Disposable[] = [];
    private configWatcher: vscode.Disposable | null = null;
    
    // Store registered providers for disposal
    private registeredProviders: vscode.Disposable[] = [];

    constructor(private configService: IConfigService) {
        // Dependency injection - ConfigService is injected for testability
    }

    /**
     * Register all completion providers
     */
    public registerProviders(context: vscode.ExtensionContext): void {
        const autoCompletionSettings = this.configService.getAutoCompletionSettings();
        
        // Register completion providers with appropriate trigger characters
        const keywordProvider = vscode.languages.registerCompletionItemProvider(
            'hledger',
            new NewKeywordCompletionProvider(),
            ...autoCompletionSettings.triggerChars
        );

        const accountProvider = vscode.languages.registerCompletionItemProvider(
            'hledger',
            new NewAccountCompletionProvider(),
            ...autoCompletionSettings.triggerCharsWithSpace // Space is needed for account lines
        );

        const commodityProvider = vscode.languages.registerCompletionItemProvider(
            'hledger',
            new NewCommodityCompletionProvider(),
            ...autoCompletionSettings.triggerCharsWithSpace // Space is needed after amounts
        );

        const dateProvider = vscode.languages.registerCompletionItemProvider(
            'hledger',
            new NewDateCompletionProvider(),
            ...autoCompletionSettings.triggerChars // No space trigger for dates
        );

        const payeeProvider = vscode.languages.registerCompletionItemProvider(
            'hledger',
            new NewPayeeCompletionProvider(),
            ...autoCompletionSettings.triggerCharsWithSpace // Space is needed after date
        );

        const tagProvider = vscode.languages.registerCompletionItemProvider(
            'hledger',
            new NewTagCompletionProvider(),
            ...autoCompletionSettings.triggerChars // No space trigger for tags
        );

        // Store providers for disposal
        this.registeredProviders = [
            keywordProvider,
            accountProvider,
            commodityProvider,
            dateProvider,
            payeeProvider,
            tagProvider
        ];

        // Add to context subscriptions
        context.subscriptions.push(...this.registeredProviders);
        this.disposables.push(...this.registeredProviders);
    }

    /**
     * Register Enter key handler for smart indentation
     */
    public registerEnterKeyHandler(context: vscode.ExtensionContext): void {
        const enterKeyHandler = new HLedgerEnterCommand();
        
        context.subscriptions.push(enterKeyHandler);
        this.disposables.push(enterKeyHandler);
    }

    /**
     * Update providers when configuration changes
     */
    public updateProvidersOnConfigChange(): void {
        if (this.configWatcher) {
            return; // Already watching
        }

        this.configWatcher = this.configService.onDidChangeConfiguration(event => {
            if (this.configService.affectsConfiguration(event, 'hledger.autoCompletion.enabled')) {
                // Restart extension to apply new settings
                // This is the same behavior as the original implementation
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });

        this.disposables.push(this.configWatcher);
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        // Dispose configuration watcher
        if (this.configWatcher) {
            this.configWatcher.dispose();
            this.configWatcher = null;
        }

        // Dispose all registered providers
        for (const provider of this.registeredProviders) {
            try {
                provider.dispose();
            } catch (error) {
                console.warn('ProviderService: Error disposing provider:', error);
            }
        }
        this.registeredProviders = [];

        // Dispose all tracked disposables
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.warn('ProviderService: Error disposing resource:', error);
            }
        }
        
        this.disposables = [];
    }
}