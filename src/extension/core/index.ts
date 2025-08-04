/**
 * Core module exports for the refactored HLedger extension
 * Provides clean separation of concerns with specialized components
 */

// Interfaces
export * from './interfaces';

// Core components
export { HLedgerParser } from './HLedgerParser';
export { DataStore } from './DataStore';
export { UsageTracker } from './UsageTracker';
export { FileScanner } from './FileScanner';
export { ConfigManager } from './ConfigManager';

// Type aliases for backward compatibility
export type { IConfigManager as IHLedgerConfig } from './interfaces';