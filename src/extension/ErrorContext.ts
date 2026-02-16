import * as os from 'os';

// eslint-disable-next-line no-undef
const EXTENSION_VERSION = require('../../package.json').version as string;

export function getErrorContext(): string {
  return `[v${EXTENSION_VERSION}, ${os.platform()}-${os.arch()}, Node ${process.version}]`;
}

export function formatErrorWithContext(message: string, error?: Error): string {
  const ctx = getErrorContext();
  const detail = error ? `: ${error.message}` : '';
  return `${message}${detail} ${ctx}`;
}
