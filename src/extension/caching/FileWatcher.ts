/**
 * Production-ready file watcher with debouncing, error handling, and memory management
 * 
 * This implementation provides:
 * - Debounced file system events to prevent excessive operations
 * - Proper resource cleanup to prevent memory leaks
 * - Error boundary with graceful degradation
 * - HLedger-specific file pattern matching
 * - Event batching for performance
 */

import * as vscode from 'vscode';
import { 
    IFileWatcher, 
    FileWatcherConfig, 
    FileSystemEvent, 
    InvalidationEventType,
    FilePath,
    createFilePath,
    FileWatcherError
} from './interfaces';

/**
 * Debounced event batch for processing multiple events together
 */
interface DebouncedEventBatch {
    readonly events: readonly FileSystemEvent[];
    readonly timestamp: number;
}

/**
 * Internal event queue item
 */
interface QueuedEvent {
    readonly event: FileSystemEvent;
    readonly timeout: NodeJS.Timeout;
}

/**
 * File watcher implementation with advanced debouncing and error handling
 */
export class FileWatcher implements IFileWatcher {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly eventListeners: Set<(event: FileSystemEvent) => void> = new Set();
    private readonly eventQueue: Map<string, QueuedEvent> = new Map();
    private readonly fileSystemWatchers: vscode.FileSystemWatcher[] = [];
    
    private _config: FileWatcherConfig | null = null;
    private _isActive: boolean = false;
    private eventCount: number = 0;
    private lastEventTime: number = Date.now();
    
    // === PUBLIC INTERFACE ===
    
    /**
     * Start watching files with the given configuration
     */
    async start(config: FileWatcherConfig): Promise<void> {
        if (this._isActive) {
            await this.stop();
        }
        
        try {
            this._config = config;
            await this.initializeWatchers(config);
            this._isActive = true;
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('FileWatcher: Started watching with patterns:', config.patterns);
            }
        } catch (error) {
            throw new FileWatcherError(
                'Failed to start file watcher',
                undefined,
                { config },
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
    
    /**
     * Stop watching files and cleanup resources
     */
    async stop(): Promise<void> {
        try {
            // Clear all pending timeouts
            for (const queuedEvent of this.eventQueue.values()) {
                clearTimeout(queuedEvent.timeout);
            }
            this.eventQueue.clear();
            
            // Dispose file system watchers
            for (const watcher of this.fileSystemWatchers) {
                watcher.dispose();
            }
            this.fileSystemWatchers.length = 0;
            
            // Dispose all other resources
            for (const disposable of this.disposables) {
                disposable.dispose();
            }
            this.disposables.length = 0;
            
            this._isActive = false;
            this._config = null;
            
            if (process.env.NODE_ENV !== 'test') {
                console.log('FileWatcher: Stopped and cleaned up resources');
            }
        } catch (error) {
            throw new FileWatcherError(
                'Failed to stop file watcher',
                undefined,
                {},
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
    
    /**
     * Add event listener for file system events
     */
    onFileSystemEvent(listener: (event: FileSystemEvent) => void): vscode.Disposable {
        this.eventListeners.add(listener);
        
        return new vscode.Disposable(() => {
            this.eventListeners.delete(listener);
        });
    }
    
    /**
     * Check if watcher is currently active
     */
    get isActive(): boolean {
        return this._isActive;
    }
    
    /**
     * Get current configuration (readonly)
     */
    get config(): Readonly<FileWatcherConfig> | null {
        return this._config ? { ...this._config } : null;
    }
    
    // === PRIVATE IMPLEMENTATION ===
    
    /**
     * Initialize file system watchers for all patterns
     */
    private async initializeWatchers(config: FileWatcherConfig): Promise<void> {
        for (const pattern of config.patterns) {
            try {
                const watcher = this.createFileSystemWatcher(pattern, config);
                this.fileSystemWatchers.push(watcher);
                this.disposables.push(watcher);
            } catch (error) {
                console.warn(`FileWatcher: Failed to create watcher for pattern ${pattern}:`, error);
                // Continue with other patterns - graceful degradation
            }
        }
        
        if (this.fileSystemWatchers.length === 0) {
            throw new FileWatcherError(
                'No file system watchers could be created',
                undefined,
                { patterns: config.patterns }
            );
        }
    }
    
    /**
     * Create a single file system watcher for a pattern
     */
    private createFileSystemWatcher(pattern: string, config: FileWatcherConfig): vscode.FileSystemWatcher {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        // Register event handlers with proper error boundaries
        watcher.onDidCreate(uri => this.handleFileSystemEvent({
            type: InvalidationEventType.FILE_CREATED,
            uri,
            timestamp: Date.now()
        }));
        
        watcher.onDidChange(uri => this.handleFileSystemEvent({
            type: InvalidationEventType.FILE_MODIFIED,
            uri,
            timestamp: Date.now()
        }));
        
        watcher.onDidDelete(uri => this.handleFileSystemEvent({
            type: InvalidationEventType.FILE_DELETED,
            uri,
            timestamp: Date.now()
        }));
        
        return watcher;
    }
    
    /**
     * Handle file system event with debouncing and filtering
     */
    private handleFileSystemEvent(event: FileSystemEvent): void {
        try {
            // Check if we should process this event
            if (!this.shouldProcessEvent(event)) {
                return;
            }
            
            const filePath = createFilePath(event.uri.fsPath);
            const eventKey = this.getEventKey(event);
            
            // Clear existing timeout for this file if exists
            const existingEvent = this.eventQueue.get(eventKey);
            if (existingEvent) {
                clearTimeout(existingEvent.timeout);
            }
            
            // Create debounced event
            const timeout = setTimeout(() => {
                this.processEvent(event);
                this.eventQueue.delete(eventKey);
            }, this._config?.debounceMs || 100);
            
            this.eventQueue.set(eventKey, { event, timeout });
            
            // Track event count for monitoring
            this.eventCount++;
            this.lastEventTime = Date.now();
            
        } catch (error) {
            console.error('FileWatcher: Error handling file system event:', error);
            // Don't throw - maintain watcher stability
        }
    }
    
    /**
     * Check if event should be processed based on filters
     */
    private shouldProcessEvent(event: FileSystemEvent): boolean {
        if (!this._config) {
            return false;
        }
        
        const filePath = event.uri.fsPath;
        
        // Check exclude patterns
        for (const excludePattern of this._config.excludePatterns) {
            if (this.matchesPattern(filePath, excludePattern)) {
                return false;
            }
        }
        
        // Check if we've exceeded max events
        if (this.eventQueue.size >= this._config.maxEvents) {
            console.warn('FileWatcher: Event queue full, dropping event for:', filePath);
            return false;
        }
        
        // Check for HLedger file extensions
        return this.isHLedgerFile(filePath);
    }
    
    /**
     * Check if file is an HLedger file
     */
    private isHLedgerFile(filePath: string): boolean {
        const hledgerExtensions = ['.journal', '.hledger', '.ledger'];
        const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        return hledgerExtensions.includes(ext) || filePath.endsWith('/journal');
    }
    
    /**
     * Simple pattern matching for file paths
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex for basic matching
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')  // ** matches any path
            .replace(/\*/g, '[^/]*') // * matches any filename chars
            .replace(/\?/g, '.');    // ? matches single char
        
        const regex = new RegExp(regexPattern);
        return regex.test(filePath);
    }
    
    /**
     * Generate unique key for event deduplication
     */
    private getEventKey(event: FileSystemEvent): string {
        return `${event.type}:${event.uri.fsPath}`;
    }
    
    /**
     * Process the actual event and notify listeners
     */
    private processEvent(event: FileSystemEvent): void {
        try {
            // Notify all listeners with error boundaries
            for (const listener of this.eventListeners) {
                try {
                    listener(event);
                } catch (error) {
                    console.error('FileWatcher: Error in event listener:', error);
                    // Continue with other listeners
                }
            }
            
            if (process.env.NODE_ENV !== 'test') {
                console.log(`FileWatcher: Processed ${event.type} for ${event.uri.fsPath}`);
            }
        } catch (error) {
            console.error('FileWatcher: Error processing event:', error);
        }
    }
    
    // === DIAGNOSTIC METHODS ===
    
    /**
     * Get diagnostic information about the watcher
     */
    getDiagnostics(): {
        isActive: boolean;
        watcherCount: number;
        eventCount: number;
        queueSize: number;
        lastEventTime: number;
        config: FileWatcherConfig | null;
    } {
        return {
            isActive: this._isActive,
            watcherCount: this.fileSystemWatchers.length,
            eventCount: this.eventCount,
            queueSize: this.eventQueue.size,
            lastEventTime: this.lastEventTime,
            config: this._config
        };
    }
    
    /**
     * Reset event counters (for testing)
     */
    resetCounters(): void {
        this.eventCount = 0;
        this.lastEventTime = Date.now();
    }
}

/**
 * Factory function to create a configured FileWatcher instance
 */
export function createFileWatcher(): IFileWatcher {
    return new FileWatcher();
}

/**
 * Default file watcher configuration for HLedger files
 */
export const DEFAULT_HLEDGER_WATCHER_CONFIG: FileWatcherConfig = {
    patterns: [
        '**/*.journal',
        '**/*.hledger', 
        '**/*.ledger',
        '**/journal'  // Files named 'journal' without extension
    ],
    excludePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.vscode/**',
        '**/target/**',
        '**/dist/**',
        '**/build/**'
    ],
    debounceMs: 100,
    maxEvents: 100,
    enableRecursive: true
} as const;