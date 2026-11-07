import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Listing, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { configureApp } from '../src/configure-app';
import { CLOUDINARY } from '../src/modules/cloudinary/cloudinary.provider';
import { resetThrottle } from './helpers/reset-throttle';
import { matchesWhere } from './helpers/match-where';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: (token: string) =>
        Promise.resolve(
          ['owner', 'other', 'admin', 'limited'].includes(token)
            ? {
                data: { user: { id: token, email: `${token}@pilot.test` } },
                error: null,
              }
            : { data: { user: null }, error: new Error('Invalid token') },
        ),
    },
  }),
}));

// HTTP tests exercise the real auth guard, admin guard, validation and services.
// Supabase verification and Prisma persistence are test doubles; no live data is changed.
/** The defaults the real database applies to new rows. */
const databaseDefaults: Partial<Listing> = {
  category: 'PROPERTY',
  ratePeriod: 'MONTH',
  attributes: null,
  title: null,
  description: null,
  depositAmount: null,
};

describe('Users and listings HTTP flow', () => {
  it('registers the radius guard on the actual public endpoint without throttling ordinary browsing', async () => {
    for (let attempt = 0; attempt < 20; attempt++)
      await request(app.getHttpServer())
        .get('/listings?searchLatitude=6')
        .expect(400);
    await request(app.getHttpServer())
      .get('/listings?searchLatitude=6&searchLongitude=80&searchRadiusKm=3')
      .expect(429);
    await request(app.getHttpServer()).get('/listings').expect(200);
  });
  let app: INestApplication<App>;
  let users: User[];
  let listings: Listing[];
  const input = {
    propertyType: 'HOUSE',
    size: 'N_A',
    bedrooms: 2,
    bathrooms: 1,
    parking: true,
    furnishing: 'UNFURNISHED',
    areaText: 'Nugegoda',
    monthlyRent: 85000,
    minDurationMonths: 12,
    keyMoney: false,
    ownerContact: '+94712345678',
    photoUrls: ['https://images.example.org/house.jpg'],
  };
  const matches = (listing: Listing, where: Record<string, unknown>) =>
    matchesWhere(listing, where);

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    const prisma = {
      adminPermission: { findUnique: () => Promise.resolve(null) },
      user: {
        upsert: ({
          where,
          create,
        }: {
          where: { authUserId: string };
          create: Omit<User, 'id' | 'phone' | 'createdAt'>;
        }) => {
          const existing = users.find(
            (user) => user.authUserId === where.authUserId,
          );
          if (existing) return Promise.resolve(existing);
          const user = {
            id: randomUUID(),
            phone: null,
            createdAt: new Date(),
            ...create,
            accountStatus: create.accountStatus ?? 'ACTIVE',
            suspendedAt: create.suspendedAt ?? null,
            suspensionReason: create.suspensionReason ?? null,
          };
          users.push(user);
          return Promise.resolve(user);
        },
        findUnique: ({ where }: { where: { authUserId: string } }) => {
          const user = users.find(
            (user) => user.authUserId === where.authUserId,
          );
          return Promise.resolve(
            user
              ? {
                  ...user,
                  adminPermission: {
                    canApproveListings: user.authUserId === 'admin',
                  },
                }
              : null,
          );
        },
      },
      match: { updateMany: () => Promise.resolve({ count: 0 }) },
      notification: { create: () => Promise.resolve({}) },
      adminActivity: { create: () => Promise.resolve({}) },
      // The service passes ready-made operations; running them all is equivalent for this in-memory store.
      $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
      listing: {
        update: ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Listing>;
        }) => {
          const row = listings.find((listing) => listing.id === where.id);
          if (!row) return Promise.reject(new Error('not found'));
          Object.assign(row, data);
          return Promise.resolve(row);
        },
        create: ({
          data,
        }: {
          data: Omit<
            Listing,
            | 'id'
            | 'createdAt'
            | 'updatedAt'
            | 'lastAvailabilityConfirmedAt'
            | 'deletedAt'
            | 'deletedByAdminId'
            | 'deletionReason'
            | 'reminderSentAt'
          >;
        }) => {
          const listing = {
            id: randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastAvailabilityConfirmedAt: null,
            deletedAt: null,
            deletedByAdminId: null,
            deletionReason: null,
            reminderSentAt: null,
            ...databaseDefaults,
            ...data,
          };
          listings.push(listing);
          return Promise.resolve(listing);
        },
        findMany: ({
          where,
          skip = 0,
          take = 21,
        }: {
          where: Partial<Listing>;
          skip?: number;
          take?: number;
        }) =>
          Promise.resolve(
            listings
              .filter((listing) => matches(listing, where))
              .slice(skip, skip + take),
          ),
        findFirst: ({ where }: { where: Partial<Listing> }) =>
          Promise.resolve(
            listings.find((listing) => matches(listing, where)) ?? null,
          ),
        findUnique: ({ where }: { where: Partial<Listing> }) =>
          Promise.resolve(
            listings.find((listing) => matches(listing, where)) ?? null,
          ),
        findUniqueOrThrow: ({ where }: { where: Partial<Listing> }) =>
          Promise.resolve(listings.find((listing) => matches(listing, where))),
        updateMany: ({
          where,
          data,
        }: {
          where: Partial<Listing>;
          data: Partial<Listing>;
        }) => {
          const selected = listings.filter((listing) =>
            matches(listing, where),
          );
          selected.forEach((listing) => Object.assign(listing, data));
          return Promise.resolve({ count: selected.length });
        },
      },
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(CLOUDINARY)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    // Listen once on a free port. Without this, supertest starts a temporary listener per request and stops it when
    // that request ends, which can cut off requests still in flight in the concurrent test (read ECONNRESET on CI).
    await app.listen(0);
  });
  beforeEach(() => {
    resetThrottle(app);
    listings = [];
    users = ['admin', 'limited'].map((authUserId) => ({
      id: randomUUID(),
      authUserId,
      email: `${authUserId}@pilot.test`,
      role: 'ADMIN',
      phone: null,
      createdAt: new Date(),
      accountStatus: 'ACTIVE',
      suspendedAt: null,
      suspensionReason: null,
      ownerVerificationStatus: 'NOT_REQUESTED',
      ownerVerificationRequestedAt: null,
      ownerVerificationReviewedAt: null,
      ownerVerificationNote: null,
    }));
  });
  afterAll(async () => {
    await app.close();
  });

  const call = () => request(app.getHttpServer());
  it('saves the pin and generates a public map link for the selected location', async () => {
    const response = await call()
      .post('/listings')
      .auth('owner', { type: 'bearer' })
      .send({
        ...input,
        latitude: 6.9271,
        longitude: 79.8612,
        mapLink: 'https://example.org/old-location',
      })
      .expect(201);
    const saved = listings[0];
    expect(Number(saved.latitude)).toBe(6.9271);
    expect(Number(saved.longitude)).toBe(79.8612);
    expect(saved.mapLink).toBe(
      'https://www.openstreetmap.org/?mlat=6.9271&mlon=79.8612#map=16/6.9271/79.8612',
    );
    saved.status = 'ACTIVE';
    const detail = await call()
      .get(`/listings/${response.body.id}`)
      .expect(200);
    expect(detail.body.mapLink).not.toBe(saved.mapLink);
    expect(detail.body.approximateLocation).toEqual({
      latitude: 6.9264,
      longitude: 79.8624,
    });
    expect(detail.body).not.toHaveProperty('latitude');
    expect(detail.body).not.toHaveProperty('ownerContact');
  });

  it('rejects incomplete, nonnumeric and out-of-range coordinate pairs', async () => {
    for (const coordinates of [
      { latitude: 6 },
      { longitude: 79 },
      { latitude: 91, longitude: 79 },
      { latitude: -91, longitude: 79 },
      { latitude: 6, longitude: 181 },
      { latitude: 6, longitude: -181 },
      { latitude: '6', longitude: 79 },
      { latitude: null, longitude: 79 },
      { latitude: null, longitude: null },
    ]) {
      await call()
        .post('/listings')
        .auth('owner', { type: 'bearer' })
        .send({ ...input, ...coordinates })
        .expect(400);
    }
    expect(listings).toHaveLength(0);
  });

  it('accepts zero coordinates and keeps manually supplied links without a pin', async () => {
    await call()
      .post('/listings')
      .auth('owner', { type: 'bearer' })
      .send({ ...input, latitude: 0, longitude: 0 })
      .expect(201);
    expect(listings[0].mapLink).toContain('mlat=0&mlon=0');
    await call()
      .post('/listings')
      .auth('owner', { type: 'bearer' })
      .send({ ...input, mapLink: 'https://example.org/map' })
      .expect(201);
    expect(listings[1].mapLink).toBe('https://example.org/map');
  });

  async function submit() {
    const result = await call()
      .post('/listings')
      .auth('owner', { type: 'bearer' })
      .send(input)
      .expect(201);
    return result.body as Listing;
  }

  describe('owner deletes a property', () => {
    it('requires a sign-in and answers 401, not a server error', async () => {
      const listing = await submit();
      await call().patch(`/listings/${listing.id}/delete`).expect(401);
      await call()
        .patch(`/listings/${listing.id}/delete`)
        .auth('invalid', { type: 'bearer' })
        .expect(401);
      expect(
        listings.find((row) => row.id === listing.id)?.deletedAt,
      ).toBeNull();
    });

    it('lets the owner remove it, after which it disappears from their list', async () => {
      const listing = await submit();
      const response = await call()
        .patch(`/listings/${listing.id}/delete`)
        .auth('owner', { type: 'bearer' })
        .expect(200);
      expect(response.body).toMatchObject({ id: listing.id });
      expect(
        listings.find((row) => row.id === listing.id)?.deletedAt,
      ).toBeInstanceOf(Date);
      const mine = await call()
        .get('/listings/mine')
        .auth('owner', { type: 'bearer' })
        .expect(200);
      expect(
        (mine.body as { data: { id: string }[] }).data.map((row) => row.id),
      ).not.toContain(listing.id);
    });

    it('refuses to let someone else remove it', async () => {
      const listing = await submit();
      await call()
        .patch(`/listings/${listing.id}/delete`)
        .auth('other', { type: 'bearer' })
        .expect(403);
      expect(
        listings.find((row) => row.id === listing.id)?.deletedAt,
      ).toBeNull();
    });
  });

  it('rejects missing and invalid tokens', async () => {
    await call().get('/users/me').expect(401);
    await call()
      .get('/users/me')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
    await call().post('/listings').send(input).expect(401);
  });
  it('returns one database user across repeated and concurrent requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        call().get('/users/me').auth('owner', { type: 'bearer' }).expect(200),
      ),
    );
    expect(
      new Set(responses.map((response) => (response.body as User).id)).size,
    ).toBe(1);
    expect(users.filter((user) => user.authUserId === 'owner')).toHaveLength(1);
    expect((responses[0].body as User).role).toBe('RENTER');
  });
  it('sends security headers and keeps private responses uncacheable', async () => {
    const response = await call()
      .get('/listings/mine')
      .auth('owner', { type: 'bearer' })
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('never lets error responses be cached', async () => {
    const response = await call()
      .get('/listings/11111111-1111-4111-8111-999999999999')
      .expect(404);
    expect(response.headers['cache-control']).toBe('no-store');
    const invalid = await call().get('/listings?sort=random').expect(400);
    expect(invalid.headers['cache-control']).toBe('no-store');
  });
  it('lets public listing reads be cached briefly', async () => {
    const response = await call().get('/listings').expect(200);
    expect(response.headers['cache-control']).toMatch(/^public, max-age=30/);
  });
  it('rate-limits listing creation per client', async () => {
    const send = () =>
      call().post('/listings').auth('owner', { type: 'bearer' }).send(input);
    for (let attempt = 0; attempt < 10; attempt++) await send().expect(201);
    await send().expect(429);
  });
  it('creates pending listings with the database owner ID', async () => {
    const listing = await submit();
    expect(listing.photoUrls).toEqual(input.photoUrls);
    expect(listing.status).toBe('PENDING_APPROVAL');
    expect(listing.ownerId).toBe(
      users.find((user) => user.authUserId === 'owner')?.id,
    );
    expect(listing.ownerId).not.toBe('owner');
  });
  it.each([
    { ownerId: 'attacker' },
    { status: 'ACTIVE' },
    { role: 'ADMIN' },
    { monthlyRent: -1 },
    { monthlyRent: '85000' },
    { keyMoney: true },
    { ownerContact: 'owner@pilot.test' },
    { ownerContact: '0712345678' },
    { ownerContact: '+94 71 234 5678' },
    { ownerContact: '+94112345678' },
    { propertyType: 'APARTMENT', size: 'N_A' },
    { bathrooms: 0 },
    { minDurationMonths: 0 },
    { keyMoney: true, keyMoneyAmount: 0 },
    { photoUrls: ['javascript:alert(1)'] },
    { areaText: '   ' },
  ])('rejects invalid or privileged input %j', async (change) => {
    await call()
      .post('/listings')
      .auth('owner', { type: 'bearer' })
      .send({ ...input, ...change })
      .expect(400);
    expect(listings).toHaveLength(0);
  });
  it('keeps pending listings private and scopes mine and reconfirm to the owner', async () => {
    const listing = await submit();
    await call()
      .get('/listings')
      .expect(200)
      .expect({ data: [], page: 1, limit: 20, hasNextPage: false });
    await call().get(`/listings/${listing.id}`).expect(404);
    await call()
      .get('/listings/mine')
      .auth('other', { type: 'bearer' })
      .expect(200)
      .expect({ data: [], page: 1, limit: 20, hasNextPage: false });
    const mine = await call()
      .get('/listings/mine')
      .auth('owner', { type: 'bearer' })
      .expect(200);
    expect((mine.body as { data: Listing[] }).data[0].id).toBe(listing.id);
    await call()
      .patch(`/listings/${listing.id}/reconfirm`)
      .auth('other', { type: 'bearer' })
      .expect(404);
    const result = await call()
      .patch(`/listings/${listing.id}/reconfirm`)
      .auth('owner', { type: 'bearer' })
      .expect(200);
    expect((result.body as Listing).lastAvailabilityConfirmedAt).toBeTruthy();
    expect((result.body as Listing).status).toBe('PENDING_APPROVAL');
  });
  it('requires approval permission and never exposes owner fields after approval', async () => {
    const listing = await submit();
    for (const token of ['owner', 'limited']) {
      await call()
        .patch(`/listings/${listing.id}/approve`)
        .auth(token, { type: 'bearer' })
        .expect(403);
      await call()
        .patch(`/listings/${listing.id}/reject`)
        .auth(token, { type: 'bearer' })
        .expect(403);
    }
    await call()
      .patch(`/listings/${listing.id}/approve`)
      .auth('admin', { type: 'bearer' })
      .expect(200);
    // A newly added private field must not leak through the public whitelist.
    Object.assign(listings[0], { internalNotes: 'private-note-marker' });
    for (const path of ['/listings', `/listings/${listing.id}`]) {
      const response = await call().get(path).expect(200);
      const publicListing =
        path === '/listings' ? response.body.data[0] : response.body;
      expect(publicListing).not.toHaveProperty('ownerContact');
      expect(publicListing).not.toHaveProperty('ownerId');
      expect(publicListing).not.toHaveProperty('internalNotes');
      expect(JSON.stringify(publicListing)).not.toContain('94712345678');
      expect(JSON.stringify(publicListing)).not.toContain(
        'private-note-marker',
      );
      expect(publicListing.id).toBe(listing.id);
    }
    await call()
      .patch(`/listings/${listing.id}/approve`)
      .auth('admin', { type: 'bearer' })
      .expect(409);
  });
  it('keeps rejected listings private', async () => {
    const listing = await submit();
    await call()
      .patch(`/listings/${listing.id}/reject`)
      .auth('admin', { type: 'bearer' })
      .expect(200);
    await call().get(`/listings/${listing.id}`).expect(404);
    await call()
      .get('/listings')
      .expect(200)
      .expect({ data: [], page: 1, limit: 20, hasNextPage: false });
  });
  it('returns 400 for malformed IDs and 404 for missing listings', async () => {
    await call().get('/listings/not-a-uuid').expect(400);
    await call().get(`/listings/${randomUUID()}`).expect(404);
  });
});
