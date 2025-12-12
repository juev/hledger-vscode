// services.ts - Service factory for extension dependency management
// Provides lightweight service factory pattern to replace global mutable state

import * as vscode from 'vscode';
import { HLedgerConfig } from './HLedgerConfig';
import { HLedgerParser } from './HLedgerParser';
import { SimpleProjectCache } from './SimpleProjectCache';
import { HLedgerCliService } from './services/HLedgerCliService';
import { HLedgerCliCommands } from './HLedgerCliCommands';
import { HLedgerImportCommands } from './HLedgerImportCommands';
import { ErrorNotificationHandler } from './utils/ErrorNotificationHandler';

/**
 * Collection of core extension services with proper lifecycle management.
 * Provides centralized access to all major components with guaranteed
 * initialization order and cleanup.
 *
 * Extends vscode.Disposable to integrate with VS Code's subscription system.
 */
export interface ExtensionServices extends vscode.Disposable {
    /** Configuration and cache management service */
    readonly config: HLedgerConfig;

    /** CLI service for hledger command execution */
    readonly cliService: HLedgerCliService;

    /** Command handlers for CLI operations */
    readonly cliCommands: HLedgerCliCommands;

    /** Command handlers for import operations */
    readonly importCommands: HLedgerImportCommands;

    /** Error notification handler for user-facing messages */
    readonly errorHandler: ErrorNotificationHandler;
}

/**
 * Creates and initializes all extension services in correct dependency order.
 * Services are created bottom-up:
 * 1. ErrorNotificationHandler (no dependencies)
 * 2. HLedgerParser (depends on ErrorNotificationHandler)
 * 3. SimpleProjectCache (no dependencies)
 * 4. HLedgerConfig (depends on Parser and Cache)
 * 5. HLedgerCliService (no dependencies)
 * 6. HLedgerCliCommands (depends on CliService)
 * 7. HLedgerImportCommands (depends on HLedgerConfig for journal history)
 *
 * Disposal happens in reverse order to ensure clean shutdown.
 *
 * @returns ExtensionServices object with all initialized services and dispose method
 *
 * @example
 * ```typescript
 * const services = createServices();
 * context.subscriptions.push(services);
 *
 * // Use services
 * services.config.getConfigForDocument(document);
 *
 * // Cleanup handled automatically by VS Code
 * ```
 */
export function createServices(): ExtensionServices {
    // Create services in dependency order (bottom-up)
    const errorHandler = new ErrorNotificationHandler();
    const parser = new HLedgerParser(errorHandler);
    const cache = new SimpleProjectCache();
    const config = new HLedgerConfig(parser, cache);
    const cliService = new HLedgerCliService();
    const cliCommands = new HLedgerCliCommands(cliService);
    const importCommands = new HLedgerImportCommands(config);

    return {
        config,
        cliService,
        cliCommands,
        importCommands,
        errorHandler,

        /**
         * Dispose all services in reverse order of creation (top-down).
         * Ensures proper cleanup of resources and prevents memory leaks.
         */
        dispose(): void {
            // Dispose in reverse order: top-down
            try {
                importCommands.dispose();
            } catch (error) {
                console.error('HLedger: Error disposing importCommands:', error);
            }

            try {
                cliCommands.dispose();
            } catch (error) {
                console.error('HLedger: Error disposing cliCommands:', error);
            }

            try {
                cliService.dispose();
            } catch (error) {
                console.error('HLedger: Error disposing cliService:', error);
            }

            try {
                config.dispose();
            } catch (error) {
                console.error('HLedger: Error disposing config:', error);
            }

            // Cache has no dispose method - it's just a data structure
            // Parser has no dispose method - it's stateless

            try {
                errorHandler.dispose();
            } catch (error) {
                console.error('HLedger: Error disposing errorHandler:', error);
            }
        }
    };
}
