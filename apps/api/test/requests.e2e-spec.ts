import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { CLOUDINARY } from '../src/modules/cloudinary/cloudinary.provider';
import { configureApp } from '../src/configure-app';
import { resetThrottle } from './helpers/reset-throttle';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: (token: string) =>
        Promise.resolve({
          data: {
            user: [
              'renter',
              'other',
              'admin',
              'limited',
              'impostor',
              'unprovisioned',
            ].includes(token)
              ? { id: token, email: `${token}@pilot.test` }
              : null,
          },
          error: null,
        }),
    },
  }),
}));

// Real routes, guards, DTO validation and services; no live database writes.
describe('Requests module HTTP routes', () => {
  let app: INestApplication<App>;
  const requestId = '11111111-1111-4111-8111-111111111111';
  const input = {
    areaText: 'Galle',
    budgetMax: 120000,
    durationMonths: 12,
    propertyType: 'HOUSE',
    renterContact: '+94712345678',
  };
  const row = {
    id: requestId,
    ...input,
    renterId: 'db-renter',
    status: 'OPEN',
  };
  const rentalRequest = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        rentalRequest,
        user: {
          findUnique: ({ where }: { where: { authUserId: string } }) =>
            Promise.resolve(
              where.authUserId === 'unprovisioned'
                ? null
                : {
                    id: `db-${where.authUserId}`,
                    authUserId: where.authUserId,
                    role: ['admin', 'limited'].includes(where.authUserId)
                      ? 'ADMIN'
                      : 'RENTER',
                    adminPermission: {
                      canApproveListings: ['admin', 'impostor'].includes(
                        where.authUserId,
                      ),
                    },
                  },
            ),
        },
      })
      .overrideProvider(CLOUDINARY)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => {
    resetThrottle(app);
    jest.clearAllMocks();
    rentalRequest.create.mockResolvedValue(row);
    rentalRequest.findMany.mockResolvedValue([row]);
    rentalRequest.findUnique.mockResolvedValue(row);
    rentalRequest.update.mockResolvedValue({ ...row, status: 'CLOSED' });
  });
  afterAll(async () => {
    await app.close();
  });
  const call = () => request(app.getHttpServer());
  it('persists complete optional search areas and rejects partial or invalid perimeters', async () => {
    const area = {
      searchLatitude: 6.9271,
      searchLongitude: 79.8612,
      searchRadiusKm: 3,
    };
    await call()
      .post('/requests')
      .auth('renter', { type: 'bearer' })
      .send({ ...input, ...area })
      .expect(201);
    expect(rentalRequest.create).toHaveBeenLastCalledWith({
      data: { ...input, ...area, renterId: 'db-renter' },
    });
    for (const extra of [
      { searchLatitude: 6 },
      { ...area, searchLongitude: null },
      { ...area, searchRadiusKm: 11 },
      { ...area, searchRadiusKm: 0 },
      { ...area, searchLatitude: 91 },
      { ...area, searchLongitude: -181 },
      { ...area, areaText: '  ' },
    ]) {
      await call()
        .post('/requests')
        .auth('renter', { type: 'bearer' })
        .send({ ...input, ...extra })
        .expect(400);
    }
    expect(rentalRequest.create).toHaveBeenCalledTimes(1);
    rentalRequest.findMany.mockResolvedValue([{ ...row, ...area }]);
    const mine = await call()
      .get('/requests/mine')
      .auth('renter', { type: 'bearer' })
      .expect(200);
    expect(mine.body.data[0]).toMatchObject(area);
  });

  it('requires authentication on every request route', async () => {
    await call().post('/requests').send(input).expect(401);
    await call().get('/requests/mine').expect(401);
    await call().get('/requests').expect(401);
    await call().patch(`/requests/${requestId}/close`).expect(401);
    expect(rentalRequest.create).not.toHaveBeenCalled();
  });
  it('creates a request using the verified database renter ID', async () => {
    await call()
      .post('/requests')
      .auth('renter', { type: 'bearer' })
      .send(input)
      .expect(201);
    expect(rentalRequest.create).toHaveBeenCalledWith({
      data: { ...input, renterId: 'db-renter' },
    });
  });
  it('rejects forged ownership and invalid DTO data', async () => {
    await call()
      .post('/requests')
      .auth('renter', { type: 'bearer' })
      .send({ ...input, renterId: 'db-other' })
      .expect(400);
    await call()
      .post('/requests')
      .auth('renter', { type: 'bearer' })
      .send({ ...input, budgetMax: '120000' })
      .expect(400);
    expect(rentalRequest.create).not.toHaveBeenCalled();
  });
  it('rejects invalid contacts and inverted budgets before saving', async () => {
    for (const override of [
      { renterContact: 'not-a-phone' },
      { renterContact: '+94112345678' },
      { budgetMin: 120001 },
    ]) {
      await call()
        .post('/requests')
        .auth('renter', { type: 'bearer' })
        .send({ ...input, ...override })
        .expect(400);
    }
    expect(rentalRequest.create).not.toHaveBeenCalled();
  });
  it('accepts equal minimum and maximum budgets', async () => {
    await call()
      .post('/requests')
      .auth('renter', { type: 'bearer' })
      .send({ ...input, budgetMin: input.budgetMax })
      .expect(201);
    expect(rentalRequest.create).toHaveBeenCalled();
  });
  it('preserves the requirement to provision a database user first', async () => {
    await call()
      .post('/requests')
      .auth('unprovisioned', { type: 'bearer' })
      .send(input)
      .expect(403);
    expect(rentalRequest.create).not.toHaveBeenCalled();
  });
  it('scopes mine queries to the current renter', async () => {
    await call()
      .get('/requests/mine')
      .auth('renter', { type: 'bearer' })
      .expect(200);
    expect(rentalRequest.findMany).toHaveBeenCalledWith({
      where: { renterId: 'db-renter', deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 21,
    });
  });
  it('uses approval permission regardless of the display role', async () => {
    for (const token of ['renter', 'limited'])
      await call().get('/requests').auth(token, { type: 'bearer' }).expect(403);
    expect(rentalRequest.findMany).not.toHaveBeenCalled();
    await call().get('/requests').auth('admin', { type: 'bearer' }).expect(200);
    await call()
      .get('/requests')
      .auth('impostor', { type: 'bearer' })
      .expect(200);
    expect(rentalRequest.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      include: { assignedAdmin: { select: { id: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 21,
    });
  });
  it('allows only the owning renter to close a request', async () => {
    await call()
      .patch(`/requests/${requestId}/close`)
      .auth('other', { type: 'bearer' })
      .expect(403);
    expect(rentalRequest.update).not.toHaveBeenCalled();
    await call()
      .patch(`/requests/${requestId}/close`)
      .auth('renter', { type: 'bearer' })
      .expect(200);
    expect(rentalRequest.update).toHaveBeenCalledWith({
      where: { id: requestId },
      data: { status: 'CLOSED' },
    });
  });
  it('rejects malformed IDs and returns 404 for missing requests', async () => {
    await call()
      .patch('/requests/not-a-uuid/close')
      .auth('renter', { type: 'bearer' })
      .expect(400);
    rentalRequest.findUnique.mockResolvedValue(null);
    await call()
      .patch(`/requests/${requestId}/close`)
      .auth('renter', { type: 'bearer' })
      .expect(404);
    expect(rentalRequest.update).not.toHaveBeenCalled();
  });
});
