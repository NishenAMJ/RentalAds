/// <reference types="jest" />
import { EventEmitter } from 'node:events';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HealthController } from '../src/health.controller';
import { JsonLogger } from '../src/common/json-logger';
import { requestLogger } from '../src/common/request-logger';

describe('JsonLogger', () => {
  const build = () => {
    const lines: { line: string; isError: boolean }[] = [];
    const logger = new JsonLogger(
      (line, isError) => lines.push({ line, isError }),
      () => new Date('2026-10-15T09:00:00Z'),
    );
    return { logger, lines };
  };

  it('writes one parseable JSON object per entry, with the Nest context', () => {
    const { logger, lines } = build();
    logger.log('Server started', 'Bootstrap');
    expect(JSON.parse(lines[0].line)).toEqual({
      time: '2026-10-15T09:00:00.000Z',
      level: 'log',
      context: 'Bootstrap',
      message: 'Server started',
    });
    expect(lines[0].isError).toBe(false);
  });

  it('sends errors to the error stream and keeps the stack', () => {
    const { logger, lines } = build();
    logger.error(new Error('boom'), 'Billing');
    const entry = JSON.parse(lines[0].line) as Record<string, string>;
    expect(lines[0].isError).toBe(true);
    expect(entry).toMatchObject({ level: 'error', message: 'boom' });
    expect(entry.stack).toContain('boom');
  });

  it('keeps extra details and serialises non-string messages', () => {
    const { logger, lines } = build();
    logger.warn({ a: 1 }, { detail: true }, 'Ctx');
    expect(JSON.parse(lines[0].line)).toMatchObject({
      message: '{"a":1}',
      details: [{ detail: true }],
    });
  });
});

describe('requestLogger', () => {
  function run(headers: Record<string, string>, status = 200) {
    const response = Object.assign(new EventEmitter(), {
      statusCode: status,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
    });
    const request = {
      method: 'GET',
      path: '/listings',
      header: (name: string) => headers[name.toLowerCase()],
    };
    const next = jest.fn();
    requestLogger(request as Request, response as unknown as Response, next);
    response.emit('finish');
    return { response, next };
  }

  afterEach(() => jest.restoreAllMocks());

  it('adds a request id, logs path and status only, and continues', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { response, next } = run({});
    expect(next).toHaveBeenCalled();
    expect(response.headers['X-Request-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/listings 200 [\d.]+ms id=/),
    );
  });

  it('keeps a well-formed incoming id but replaces suspicious ones', () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    expect(
      run({ 'x-request-id': 'abc12345-trace' }).response.headers[
        'X-Request-Id'
      ],
    ).toBe('abc12345-trace');
    expect(
      run({ 'x-request-id': 'bad id\nforged-line' }).response.headers[
        'X-Request-Id'
      ],
    ).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logs failures at warn and error levels', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    run({}, 404);
    run({}, 500);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe('HealthController', () => {
  it('reports liveness without touching the database', () => {
    const prisma = { $queryRaw: jest.fn() };
    const result = new HealthController(prisma as never).live();
    expect(result.status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('is ready when the database answers', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    await expect(
      new HealthController(prisma as never).ready(),
    ).resolves.toEqual({
      status: 'ready',
    });
  });

  it('returns 503 without leaking details when the database is down', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(new Error('password for db host x')),
    };
    const call = new HealthController(prisma as never).ready();
    await expect(call).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(call).rejects.toThrow('Service is not ready');
  });
});
