import * as vscode from 'vscode';
import { IConfigService } from './interfaces';

/**
 * Service for managing VS Code configuration and settings
 * Implements Single Responsibility Principle by focusing only on configuration management
 */
export class ConfigService implements IConfigService {
    private _onDidChangeConfiguration = new vscode.EventEmitter<vscode.ConfigurationChangeEvent>();
    public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    
    private configWatcher: vscode.Disposable | null = null;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        // Initialize event emitter disposal tracking
        this.disposables.push(this._onDidChangeConfiguration);
    }

    /**
     * Get configuration value
     */
    public get<T>(section: string, defaultValue?: T): T | undefined {
        const config = vscode.workspace.getConfiguration();
        if (defaultValue !== undefined) {
            return config.get<T>(section, defaultValue);
        }
        return config.get<T>(section);
    }

    /**
     * Get configuration section
     */
    public getSection(section: string): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(section);
    }

    /**
     * Check if configuration affects the specified section
     */
    public affectsConfiguration(event: vscode.ConfigurationChangeEvent, section: string): boolean {
        return event.affectsConfiguration(section);
    }

    /**
     * Start watching for configuration changes
     */
    public startWatching(): void {
        if (this.configWatcher) {
            return; // Already watching
        }

        this.configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            this._onDidChangeConfiguration.fire(event);
        });

        this.disposables.push(this.configWatcher);
    }

    /**
     * Stop watching for configuration changes
     */
    public stopWatching(): void {
        if (this.configWatcher) {
            this.configWatcher.dispose();
            this.configWatcher = null;
        }
    }

    /**
     * Get completion limits from configuration
     */
    public getCompletionLimits(): { maxResults: number; maxAccountResults: number } {
        const config = this.getSection('hledger.autoCompletion');
        return {
            maxResults: config.get<number>('maxResults', 25),
            maxAccountResults: config.get<number>('maxAccountResults', 30)
        };
    }

    /**
     * Get auto completion settings
     */
    public getAutoCompletionSettings(): {
        enabled: boolean;
        triggerChars: string[];
        triggerCharsWithSpace: string[];
    } {
        const config = this.getSection('hledger');
        const autoCompletionEnabled = config.get<boolean>('autoCompletion.enabled', true);
        
        // Define trigger characters based on setting - include letters and numbers for auto-trigger
        // Note: Space removed from base triggers to prevent unwanted completions after dates
        const baseTriggerChars = [':', '/', '-', '.', ';'];
        const autoTriggerChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
        const triggerChars = autoCompletionEnabled ? [...baseTriggerChars, ...autoTriggerChars] : [];
        
        // Special trigger chars for providers that need space
        const triggerCharsWithSpace = autoCompletionEnabled ? [' ', ...baseTriggerChars, ...autoTriggerChars] : [' '];

        return {
            enabled: autoCompletionEnabled,
            triggerChars,
            triggerCharsWithSpace
        };
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.stopWatching();
        
        // Dispose all tracked disposables
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.warn('ConfigService: Error disposing resource:', error);
            }
        }
        
        this.disposables = [];
    }
}