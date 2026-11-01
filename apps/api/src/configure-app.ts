import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';
import helmet from 'helmet';
import { requestLogger } from './common/request-logger';
import type { Express, Request, Response } from 'express';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const proxies =
    config
      .get<string>('TRUSTED_PROXY_CIDRS')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  for (const proxy of proxies) {
    const [address, prefix, ...extra] = proxy.split('/');
    const version = isIP(address);
    if (
      !version ||
      extra.length ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128)))
    )
      throw new Error(
        'TRUSTED_PROXY_CIDRS must contain only trusted proxy IP addresses or CIDR ranges',
      );
  }
  // Express resolves req.ip through only explicitly trusted infrastructure.
  const server = app.getHttpAdapter().getInstance() as Express;
  server.set('trust proxy', proxies.length ? proxies : false);
  const configuredOrigin =
    config.get<string>('FRONTEND_URL') ?? config.get<string>('WEB_ORIGIN');
  if (!configuredOrigin && config.get<string>('NODE_ENV') === 'production') {
    throw new Error('FRONTEND_URL must be configured in production.');
  }
  const value = configuredOrigin ?? 'http://localhost:3000';
  let frontendOrigin: string;
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    )
      throw new Error('Invalid origin');
    frontendOrigin = url.origin;
  } catch {
    throw new Error(
      'FRONTEND_URL (or WEB_ORIGIN) must be a single HTTP(S) origin without credentials, a path, query, or wildcard.',
    );
  }
  // Security headers. The API serves JSON to a separate origin, so resources may be read cross-origin.
  // Request ids and one access-log line per request. Skipped in tests to keep output readable.
  if (config.get<string>('NODE_ENV') !== 'test') app.use(requestLogger);
  // Responses are private and uncacheable unless a route opts in (see PUBLIC_CACHE).
  app.use((_request: unknown, response: Response, next: () => void) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  const secureHeaders = helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  // The interactive docs page needs inline scripts that these strict headers forbid. It carries no private data.
  app.use((request: Request, response: Response, next: () => void) =>
    request.path.startsWith('/docs')
      ? next()
      : secureHeaders(request, response, next),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed: boolean) => void,
    ) => {
      callback(null, origin === frontendOrigin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.enableShutdownHooks();
}
