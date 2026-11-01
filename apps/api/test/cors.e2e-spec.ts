import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/configure-app';

@Controller()
class CorsProbeController {
  @Get() get() {
    return { ok: true };
  }
}

describe('CORS configuration', () => {
  let app: INestApplication<App> | undefined;
  async function create(values: Record<string, string> = {}) {
    const module = await Test.createTestingModule({
      controllers: [CorsProbeController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: (key: string) => values[key] },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    return app;
  }
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
  it('allows the configured frontend with credentials and authenticated preflights', async () => {
    const api = await create({
      FRONTEND_URL: 'https://frontend.example/',
      WEB_ORIGIN: 'https://old.example',
      NODE_ENV: 'production',
    });
    const response = await request(api.getHttpServer())
      .options('/')
      .set('Origin', 'https://frontend.example')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://frontend.example',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
    // The owner calendar removes blocked dates with DELETE; without this the browser blocks the request.
    expect(response.headers['access-control-allow-methods']).toContain(
      'DELETE',
    );
    expect(response.headers['access-control-allow-headers']).toContain(
      'Authorization',
    );
    await request(api.getHttpServer())
      .get('/')
      .set('Origin', 'https://frontend.example')
      .expect('Access-Control-Allow-Origin', 'https://frontend.example');
  });
  it('does not grant browser access to other origins or reflect arbitrary origins', async () => {
    const api = await create({
      FRONTEND_URL: 'https://frontend.example',
      WEB_ORIGIN: 'https://old.example',
    });
    for (const origin of [
      'https://attacker.example',
      'https://frontend.example.attacker.example',
      'http://frontend.example',
      'https://old.example',
      'null',
    ]) {
      const response = await request(api.getHttpServer())
        .get('/')
        .set('Origin', origin)
        .expect(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(
        response.headers['access-control-allow-credentials'],
      ).toBeUndefined();
      const preflight = await request(api.getHttpServer())
        .options('/')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
  it('keeps requests without an Origin header usable', async () => {
    const api = await create();
    const response = await request(api.getHttpServer()).get('/').expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('defaults to localhost in development', async () => {
    const api = await create();
    await request(api.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3000')
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000');
  });
  it('supports the existing explicit WEB_ORIGIN in production', async () => {
    const api = await create({
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://legacy.example',
    });
    await request(api.getHttpServer())
      .get('/')
      .set('Origin', 'https://legacy.example')
      .expect('Access-Control-Allow-Origin', 'https://legacy.example');
  });
  it('refuses missing production configuration', async () => {
    await expect(create({ NODE_ENV: 'production' })).rejects.toThrow(
      'must be configured',
    );
  });
  it.each([
    '*',
    'https://*.example',
    'https://a.example,https://b.example',
    'ftp://frontend.example',
    'https://frontend.example/path',
    'https://user:pass@frontend.example',
    'https://frontend.example?q=1',
    'https://frontend.example#fragment',
    '',
  ])('rejects invalid origin %s', async (value) => {
    await expect(create({ FRONTEND_URL: value })).rejects.toThrow(
      'must be a single HTTP(S) origin',
    );
  });
});
