/**
 * Logger utility that prefixes all logs with the class name
 *
 * Usage:
 * const logger = new Logger('MyClassName');
 * logger.log('Something happened');        // Output: [MyClassName] Something happened
 * logger.warn('Warning message');          // Output: [MyClassName] Warning message
 * logger.error('Error occurred', error);   // Output: [MyClassName] Error occurred {error details}
 */
export class Logger {
  private readonly prefix: string;

  constructor(context: string) {
    this.prefix = `[${context}]`;
  }

  private format(...args: any[]) {
    const timestamp = new Date().toISOString();
    return [`${timestamp} ${this.prefix}`, ...args];
  }

  log(...args: unknown[]): void {
    console.log(...this.format(...args));
  }

  warn(...args: unknown[]): void {
    console.warn(...this.format(...args));
  }

  error(...args: unknown[]): void {
    console.error(...this.format(...args));
  }

  info(...args: unknown[]): void {
    console.info(...this.format(...args));
  }

  debug(...args: unknown[]): void {
    console.debug(...this.format(...args));
  }
}