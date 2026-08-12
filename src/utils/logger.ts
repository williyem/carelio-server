type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function stamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  const color =
    level === 'error'
      ? colors.red
      : level === 'warn'
        ? colors.yellow
        : level === 'debug'
          ? colors.magenta
          : colors.cyan;

  const prefix = `${colors.dim}${stamp()}${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset}`;
  const line =
    meta !== undefined
      ? `${prefix} ${message} ${typeof meta === 'string' ? meta : JSON.stringify(meta)}\n`
      : `${prefix} ${message}\n`;
  process.stdout.write(line);
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
};
