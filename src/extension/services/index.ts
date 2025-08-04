/**
 * Services module - provides clean separation of concerns for the HLedger extension
 * Following SOLID principles with dependency injection
 */

export { IConfigService, IThemeService, IProviderService, IExtensionService } from './interfaces';
export { ConfigService } from './ConfigService';
export { ThemeService } from './ThemeService';
export { ProviderService } from './ProviderService';
export { ExtensionService } from './ExtensionService';

/**
 * Factory function to create all services with proper dependency injection
 */
export function createServices() {
    // Import classes inside function to avoid circular dependencies
    const { ConfigService } = require('./ConfigService');
    const { ThemeService } = require('./ThemeService');
    const { ProviderService } = require('./ProviderService');
    const { ExtensionService } = require('./ExtensionService');
    
    // Create services in dependency order
    const configService = new ConfigService();
    const themeService = new ThemeService(configService);
    const providerService = new ProviderService(configService);
    const extensionService = new ExtensionService(configService, themeService, providerService);

    return {
        configService,
        themeService,
        providerService,
        extensionService
    };
}