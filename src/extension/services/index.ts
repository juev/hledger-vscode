// Service factory for dependency injection
// Creates and manages all extension services with proper lifecycle management

import * as vscode from 'vscode';
import { HLedgerConfig } from '../HLedgerConfig';
import { HLedgerParser } from '../HLedgerParser';
import { SimpleProjectCache } from '../SimpleProjectCache';
import { HLedgerCliService } from './HLedgerCliService';
import { HLedgerCliCommands } from '../HLedgerCliCommands';
import { ErrorNotificationHandler } from '../utils/ErrorNotificationHandler';

/**
 * Container for all extension services
 * Implements vscode.Disposable for automatic cleanup via context.subscriptions
 */
export interface Services extends vscode.Disposable {
  readonly config: HLedgerConfig;
  readonly cliService: HLedgerCliService;
  readonly cliCommands: HLedgerCliCommands;
  readonly errorHandler: ErrorNotificationHandler;
}

class ServicesImpl implements Services {
  constructor(
    public readonly config: HLedgerConfig,
    public readonly cliService: HLedgerCliService,
    public readonly cliCommands: HLedgerCliCommands,
    public readonly errorHandler: ErrorNotificationHandler
  ) {}

  dispose(): void {
    this.config.dispose();
    this.cliCommands.dispose();
    this.cliService.dispose();
    this.errorHandler.dispose();
  }
}

/**
 * Factory function to create all extension services
 * Services are created in dependency order with proper initialization
 *
 * @returns Services container with all initialized services
 */
export function createServices(): Services {
  const errorHandler = new ErrorNotificationHandler();
  const parser = new HLedgerParser(errorHandler);
  const cache = new SimpleProjectCache();
  const config = new HLedgerConfig(parser, cache);
  const cliService = new HLedgerCliService();
  const cliCommands = new HLedgerCliCommands(cliService);

  return new ServicesImpl(config, cliService, cliCommands, errorHandler);
}
