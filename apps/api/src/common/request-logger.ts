import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');
const SAFE_ID = /^[\w-]{8,64}$/;

/**
 * Gives every request an ID (echoed in `X-Request-Id`) and logs one line when
 * it finishes. Only the path is logged, never the query string, headers or
 * body, so tokens and personal details cannot leak into logs.
 */
export function requestLogger(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header('x-request-id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader('X-Request-Id', id);
  const started = process.hrtime.bigint();
  response.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = `${request.method} ${request.path} ${response.statusCode} ${ms.toFixed(1)}ms id=${id}`;
    if (response.statusCode >= 500) logger.error(line);
    else if (response.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
