import * as vscode from 'vscode';
import { IConfigManager } from '../core';

/**
 * Service for managing VS Code configuration and settings
 */
export interface IConfigService {
    /**
     * Get configuration value
     */
    get<T>(section: string, defaultValue?: T): T | undefined;

    /**
     * Get configuration section
     */
    getSection(section: string): vscode.WorkspaceConfiguration;

    /**
     * Check if configuration affects the specified section
     */
    affectsConfiguration(event: vscode.ConfigurationChangeEvent, section: string): boolean;

    /**
     * Start watching for configuration changes
     */
    startWatching(): void;

    /**
     * Stop watching for configuration changes
     */
    stopWatching(): void;

    /**
     * Get completion limits from configuration
     */
    getCompletionLimits(): { maxResults: number; maxAccountResults: number };

    /**
     * Get auto completion settings
     */
    getAutoCompletionSettings(): {
        enabled: boolean;
        triggerChars: string[];
        triggerCharsWithSpace: string[];
    };

    /**
     * Event fired when configuration changes
     */
    onDidChangeConfiguration: vscode.Event<vscode.ConfigurationChangeEvent>;

    /**
     * Dispose of resources
     */
    dispose(): void;
}

/**
 * Service for managing theme customization and TextMate rules
 */
export interface IThemeService {
    /**
     * Apply custom colors to the theme
     */
    applyCustomColors(): Promise<void>;

    /**
     * Get current color settings
     */
    getColorSettings(): {
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
    };

    /**
     * Register color application command
     */
    registerApplyColorsCommand(context: vscode.ExtensionContext): void;

    /**
     * Dispose of resources
     */
    dispose(): void;
}

/**
 * Service for managing completion provider registration
 */
export interface IProviderService {
    /**
     * Register all completion providers
     */
    registerProviders(context: vscode.ExtensionContext): void;

    /**
     * Register Enter key handler for smart indentation
     */
    registerEnterKeyHandler(context: vscode.ExtensionContext): void;

    /**
     * Update providers when configuration changes
     */
    updateProvidersOnConfigChange(): void;

    /**
     * Dispose of resources
     */
    dispose(): void;
}

/**
 * Main extension service that orchestrates all other services
 */
export interface IExtensionService {
    /**
     * Activate the extension
     */
    activate(context: vscode.ExtensionContext): void;

    /**
     * Deactivate the extension
     */
    deactivate(): void;

    /**
     * Get HLedger configuration for a document
     */
    getConfig(document: vscode.TextDocument): IConfigManager;

    /**
     * Dispose of resources
     */
    dispose(): void;
}