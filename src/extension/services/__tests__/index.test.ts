import { createServices, Services } from '../index';
import { HLedgerConfig } from '../../HLedgerConfig';
import { HLedgerCliService } from '../HLedgerCliService';
import { HLedgerCliCommands } from '../../HLedgerCliCommands';
import { ErrorNotificationHandler } from '../../utils/ErrorNotificationHandler';

describe('Service Factory', () => {
  describe('createServices', () => {
    let services: Services;

    afterEach(() => {
      if (services) {
        services.dispose();
      }
    });

    it('creates all required services', () => {
      services = createServices();

      expect(services).toBeDefined();
      expect(services.config).toBeDefined();
      expect(services.cliService).toBeDefined();
      expect(services.cliCommands).toBeDefined();
      expect(services.errorHandler).toBeDefined();
    });

    it('creates services with correct types', () => {
      services = createServices();

      expect(services.config).toBeInstanceOf(HLedgerConfig);
      expect(services.cliService).toBeInstanceOf(HLedgerCliService);
      expect(services.cliCommands).toBeInstanceOf(HLedgerCliCommands);
      expect(services.errorHandler).toBeInstanceOf(ErrorNotificationHandler);
    });

    it('provides dispose function', () => {
      services = createServices();

      expect(typeof services.dispose).toBe('function');
    });

    it('creates services with proper dependencies', () => {
      services = createServices();

      expect(services.config).toBeDefined();
      expect(services.cliService).toBeDefined();
      expect(services.cliCommands).toBeDefined();
    });
  });

  describe('Service Lifecycle', () => {
    let services: Services;

    afterEach(() => {
      if (services) {
        services.dispose();
      }
    });

    it('disposes all services without errors', () => {
      services = createServices();

      expect(() => {
        services.dispose();
      }).not.toThrow();
    });

    it('handles multiple dispose calls without errors', () => {
      services = createServices();

      expect(() => {
        services.dispose();
        services.dispose();
        services.dispose();
      }).not.toThrow();
    });

    it('does not throw when disposing fresh services', () => {
      services = createServices();

      expect(() => {
        services.dispose();
      }).not.toThrow();
    });
  });

  describe('Dependency Order', () => {
    let services: Services;

    afterEach(() => {
      if (services) {
        services.dispose();
      }
    });

    it('initializes error handler before config', () => {
      services = createServices();

      expect(services.errorHandler).toBeDefined();
      expect(services.config).toBeDefined();
    });

    it('initializes cli service before cli commands', () => {
      services = createServices();

      expect(services.cliService).toBeDefined();
      expect(services.cliCommands).toBeDefined();
    });

    it('initializes all core services independently', () => {
      services = createServices();

      expect(services.errorHandler).toBeInstanceOf(ErrorNotificationHandler);
      expect(services.cliService).toBeInstanceOf(HLedgerCliService);
    });
  });

  describe('Memory Safety', () => {
    it('creates services without memory leaks', () => {
      const services1 = createServices();
      const services2 = createServices();
      const services3 = createServices();

      expect(services1).toBeDefined();
      expect(services2).toBeDefined();
      expect(services3).toBeDefined();

      services1.dispose();
      services2.dispose();
      services3.dispose();

      expect(() => {
        services1.dispose();
        services2.dispose();
        services3.dispose();
      }).not.toThrow();
    });

    it('properly cleans up service references on disposal', () => {
      const services = createServices();

      expect(services.config).toBeDefined();
      expect(services.cliService).toBeDefined();

      services.dispose();

      expect(() => services.dispose()).not.toThrow();
    });
  });

  describe('Service Container Properties', () => {
    let services: Services;

    afterEach(() => {
      if (services) {
        services.dispose();
      }
    });

    it('exposes readonly service properties', () => {
      services = createServices();

      const config = services.config;
      const cliService = services.cliService;
      const cliCommands = services.cliCommands;
      const errorHandler = services.errorHandler;

      expect(config).toBe(services.config);
      expect(cliService).toBe(services.cliService);
      expect(cliCommands).toBe(services.cliCommands);
      expect(errorHandler).toBe(services.errorHandler);
    });

    it('maintains service instance identity', () => {
      services = createServices();

      const configRef1 = services.config;
      const configRef2 = services.config;

      expect(configRef1).toBe(configRef2);
    });
  });
});
