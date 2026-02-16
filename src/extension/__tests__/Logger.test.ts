import * as vscode from 'vscode';
import { Logger } from '../Logger';

describe('Logger', () => {
  let channel: vscode.OutputChannel;
  let logger: Logger;

  beforeEach(() => {
    channel = vscode.window.createOutputChannel('HLedger');
    jest.clearAllMocks();
  });

  describe('info', () => {
    it('should write info message to output channel', () => {
      logger = new Logger(channel);
      logger.info('Server started');

      expect(channel.appendLine).toHaveBeenCalledTimes(1);
      expect(channel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Server started')
      );
    });

    it('should include timestamp in info message', () => {
      logger = new Logger(channel);
      logger.info('test message');

      expect(channel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });
  });

  describe('error', () => {
    it('should write error message to output channel', () => {
      logger = new Logger(channel);
      logger.error('Connection failed');

      expect(channel.appendLine).toHaveBeenCalledTimes(1);
      expect(channel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Connection failed')
      );
    });

    it('should include error details when provided', () => {
      logger = new Logger(channel);
      const err = new Error('timeout');
      logger.error('Request failed', err);

      expect(channel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Request failed')
      );
      expect(channel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('timeout')
      );
    });
  });

  describe('debug', () => {
    it('should not write debug message when debug is disabled', () => {
      const getConfig = vscode.workspace.getConfiguration as jest.Mock;
      getConfig.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'debug') return false;
          return defaultValue;
        }),
        update: jest.fn(),
        has: jest.fn(() => false),
        inspect: jest.fn(),
      });

      logger = new Logger(channel);
      logger.debug('verbose info');

      expect(channel.appendLine).not.toHaveBeenCalled();
    });

    it('should write debug message when debug is enabled', () => {
      const getConfig = vscode.workspace.getConfiguration as jest.Mock;
      getConfig.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'debug') return true;
          return defaultValue;
        }),
        update: jest.fn(),
        has: jest.fn(() => false),
        inspect: jest.fn(),
      });

      logger = new Logger(channel);
      logger.debug('verbose info');

      expect(channel.appendLine).toHaveBeenCalledTimes(1);
      expect(channel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] verbose info')
      );
    });
  });

  describe('dispose', () => {
    it('should dispose the output channel', () => {
      logger = new Logger(channel);
      logger.dispose();

      expect(channel.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
