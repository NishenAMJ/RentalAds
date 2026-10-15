import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { CLOUDINARY } from '../src/modules/cloudinary/cloudinary.provider';
import { configureApp } from '../src/configure-app';

// Exercise real DTO validation and persistence boundary without database writes.
describe('Complaint honeypot', () => {
  let app: INestApplication<App>;
  const create = jest.fn(() => Promise.resolve({ id: 'complaint-id' }));
  const input = {
    targetType: 'LISTING',
    targetId: '11111111-1111-4111-8111-111111111111',
    reason: 'Contact number does not work',
  };
  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ complaint: { create } })
      .overrideProvider(CLOUDINARY)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    const storage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    storage.onApplicationShutdown();
    storage.storage.clear();
  });
  it('enforces the complaint limit separately from ordinary listing browsing', async () => {
    await request(app.getHttpServer())
      .post('/complaints')
      .send(input)
      .expect(201);
    await request(app.getHttpServer())
      .post('/complaints')
      .send(input)
      .expect(201);
    await request(app.getHttpServer())
      .post('/complaints')
      .send(input)
      .expect(429);
    expect(create).toHaveBeenCalledTimes(2);
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([{}, { website: '' }])(
    'accepts normal submissions and never persists the honeypot: %j',
    async (extra) => {
      await request(app.getHttpServer())
        .post('/complaints')
        .send({ ...input, ...extra })
        .expect(201);
      expect(create).toHaveBeenCalledWith({ data: input });
    },
  );
  it.each(['https://spam.example', 'bot', ' ', '\n'])(
    'rejects populated honeypots before any write: %j',
    async (website) => {
      await request(app.getHttpServer())
        .post('/complaints')
        .send({ ...input, website })
        .expect(400);
      expect(create).not.toHaveBeenCalled();
    },
  );
  it.each([null, 0, false, [], {}])(
    'rejects malformed honeypots: %j',
    async (website) => {
      await request(app.getHttpServer())
        .post('/complaints')
        .send({ ...input, website })
        .expect(400);
      expect(create).not.toHaveBeenCalled();
    },
  );
  it('still validates real complaint fields when the honeypot is empty', async () => {
    await request(app.getHttpServer())
      .post('/complaints')
      .send({ ...input, website: '', reason: 'short' })
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });
});
