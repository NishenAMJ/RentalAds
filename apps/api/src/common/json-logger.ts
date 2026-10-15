import type { LogLevel, LoggerService } from '@nestjs/common';

/** Writes one JSON object per line, which log platforms can parse and search. */
export class JsonLogger implements LoggerService {
  constructor(
    private readonly write: (line: string, isError: boolean) => void = (
      line,
      isError,
    ) => (isError ? process.stderr : process.stdout).write(`${line}\n`),
    private readonly now: () => Date = () => new Date(),
  ) {}

  private emit(level: LogLevel, message: unknown, params: unknown[]) {
    // Nest passes the logger context (class name) as the last string argument.
    const context =
      typeof params.at(-1) === 'string' ? (params.at(-1) as string) : undefined;
    const rest = context ? params.slice(0, -1) : params;
    const entry: Record<string, unknown> = {
      time: this.now().toISOString(),
      level,
      ...(context ? { context } : {}),
      message:
        message instanceof Error
          ? message.message
          : typeof message === 'string'
            ? message
            : JSON.stringify(message),
      ...(message instanceof Error ? { stack: message.stack } : {}),
      ...(rest.length ? { details: rest } : {}),
    };
    this.write(JSON.stringify(entry), level === 'error' || level === 'fatal');
  }

  log(message: unknown, ...params: unknown[]) {
    this.emit('log', message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.emit('error', message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.emit('warn', message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.emit('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.emit('verbose', message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.emit('fatal', message, params);
  }
}
