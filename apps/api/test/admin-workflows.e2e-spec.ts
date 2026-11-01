import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type {
  Listing,
  RentalRequest,
  Match,
  MatchStatus,
} from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { CLOUDINARY } from '../src/modules/cloudinary/cloudinary.provider';
import { configureApp } from '../src/configure-app';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: (token: string) =>
        Promise.resolve({
          data: {
            user:
              token === 'invalid'
                ? null
                : { id: token, email: `${token}@pilot.test` },
          },
          error: null,
        }),
    },
  }),
}));

const listingId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const matchId = '33333333-3333-4333-8333-333333333333';
const complaintId = '44444444-4444-4444-8444-444444444444';
const date = new Date('2026-01-01');
const baseListing: Listing = {
  reference: 'SL-000001',
  id: listingId,
  ownerId: 'db-member',
  propertyType: 'APARTMENT',
  size: 'TWO_BR',
  bedrooms: 2,
  bathrooms: 1,
  parking: true,
  furnishing: 'UNFURNISHED',
  areaText: 'Galle',
  mapLink: null,
  latitude: null,
  longitude: null,
  monthlyRent: 80000,
  ratePeriod: 'MONTH' as const,
  category: 'PROPERTY' as const,
  attributes: null,
  title: null,
  description: null,
  depositAmount: null,
  minDurationMonths: 12,
  keyMoney: false,
  keyMoneyAmount: null,
  ownerContact: '+94712345678',
  photoUrls: ['https://images.example.org/house.jpg'],
  status: 'ACTIVE',
  lastAvailabilityConfirmedAt: null,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  deletedByAdminId: null,
  deletionReason: null,
  reminderSentAt: null,
};
const baseRequest: RentalRequest = {
  searchLatitude: null,
  searchLongitude: null,
  searchRadiusKm: null,
  id: requestId,
  renterId: 'db-member',
  propertyType: 'APARTMENT',
  size: 'TWO_BR',
  bedrooms: 2,
  parking: true,
  furnishing: null,
  areaText: 'Galle',
  budgetMin: null,
  budgetMax: 100000,
  durationMonths: 12,
  renterContact: '+94712345678',
  status: 'OPEN',
  createdAt: date,
  deletedAt: null,
  deletedByAdminId: null,
  deletionReason: null,
  assignedAdminId: null,
  assignedAt: null,
  adminNotes: null,
  followUpAt: null,
};
type Flags = {
  canApproveListings: boolean;
  canManageAdmins: boolean;
  canManageComplaints: boolean;
};
const none: Flags = {
  canApproveListings: false,
  canManageAdmins: false,
  canManageComplaints: false,
};

describe('Admin permissions, complaints and matching lifecycle', () => {
  let app: INestApplication<App>;
  let listing: Listing;
  let rental: RentalRequest;
  let saved: Match | null;
  let flags: Record<string, Flags>;
  const account = (id: string) => ({
    id: `db-${id}`,
    authUserId: id,
    email: `${id}@pilot.test`,
    role: id === 'labelOnly' ? 'ADMIN' : 'RENTER',
    adminPermission: flags[id] ?? null,
  });
  const userFind = jest.fn(
    ({ where }: { where: { authUserId?: string; email?: string } }) =>
      Promise.resolve(
        where.authUserId === 'unprovisioned'
          ? null
          : account(where.authUserId ?? where.email!.split('@')[0]),
      ),
  );
  const complaintCreate = jest.fn(({ data }: { data: object }) =>
    Promise.resolve({ id: complaintId, ...data }),
  );
  const complaintUpdate = jest.fn(({ data }: { data: object }) =>
    Promise.resolve({ id: complaintId, ...data }),
  );
  const listingFind = jest.fn(
    ({
      where,
      skip = 0,
      take = 20,
    }: {
      where: { status?: string };
      skip?: number;
      take?: number;
    }) =>
      Promise.resolve(
        (!where.status || listing.status === where.status
          ? [listing]
          : []
        ).slice(skip, skip + take),
      ),
  );
  const matchFind = jest.fn(() => Promise.resolve(saved ? [saved] : []));
  const matchUpsert = jest.fn(
    ({
      create,
      update,
    }: {
      create: Pick<Match, 'listingId' | 'requestId' | 'score'>;
      update: { score: number };
    }) => {
      saved = saved
        ? { ...saved, ...update }
        : {
            id: matchId,
            locationOverrideReason: null,
            locationOverrideAdminId: null,
            locationOverrideAt: null,
            recommendationReason: null,
            recommendedByAdminId: null,
            recommendationReviewedAt: null,
            invalidatedAt: null,
            invalidationReason: null,
            ...create,
            status: 'SUGGESTED',
            createdAt: date,
          };
      return Promise.resolve(saved);
    },
  );
  const matchUpdate = jest.fn(({ data }: { data: { status: MatchStatus } }) => {
    saved = { ...saved!, ...data };
    return Promise.resolve(saved);
  });
  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: userFind,
          upsert: ({ where }: { where: { authUserId: string } }) =>
            Promise.resolve(account(where.authUserId)),
        },
        adminPermission: {
          findUnique: ({ where }: { where: { userId: string } }) =>
            Promise.resolve(flags[where.userId.slice(3)] ?? null),
          upsert: ({
            where,
            create,
            update,
          }: {
            where: { userId: string };
            create: Flags;
            update: Partial<Flags>;
          }) => {
            const id = where.userId.slice(3);
            flags[id] = flags[id]
              ? { ...flags[id], ...update }
              : { ...none, ...create };
            return Promise.resolve(flags[id]);
          },
        },
        listing: {
          findMany: listingFind,
          findUnique: () => Promise.resolve(listing),
          findFirst: () => Promise.resolve(listing),
          findUniqueOrThrow: () => Promise.resolve(listing),
          updateMany: ({ data }: { data: Partial<Listing> }) => {
            listing = { ...listing, ...data };
            return Promise.resolve({ count: 1 });
          },
        },
        rentalRequest: {
          findUnique: () => Promise.resolve(rental),
          findMany: () => Promise.resolve([rental]),
        },
        complaint: {
          create: complaintCreate,
          findMany: () => Promise.resolve([]),
          findUnique: () => Promise.resolve({ id: complaintId }),
          update: complaintUpdate,
        },
        match: {
          findMany: matchFind,
          findUnique: ({ where }: { where: { id: string } }) =>
            Promise.resolve(saved?.id === where.id ? saved : null),
          upsert: matchUpsert,
          update: matchUpdate,
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
    jest.clearAllMocks();
    app.get<ThrottlerStorageService>(ThrottlerStorage).onApplicationShutdown();
    app.get<ThrottlerStorageService>(ThrottlerStorage).storage.clear();
    listing = { ...baseListing };
    rental = { ...baseRequest };
    saved = null;
    flags = {
      approver: { ...none, canApproveListings: true },
      moderator: { ...none, canManageComplaints: true },
      manager: { ...none, canManageAdmins: true },
      labelOnly: { ...none },
    };
  });
  afterAll(async () => {
    await app.close();
  });
  const call = () => request(app.getHttpServer());
  const report = {
    targetType: 'LISTING',
    targetId: listingId,
    reason: 'The contact number does not work',
    website: '',
  };

  const protectedRoutes: {
    method: 'get' | 'post' | 'patch';
    path: string;
    allowed: string;
    body?: object;
  }[] = [
    { method: 'get', path: '/matching/dashboard', allowed: 'approver' },
    {
      method: 'get',
      path: '/listings/admin/lookup/SL-000001',
      allowed: 'approver',
    },
    {
      method: 'get',
      path: `/matching/requests/${requestId}/candidates/${listingId}`,
      allowed: 'approver',
    },
    {
      method: 'get',
      path: `/matching/requests/${requestId}/matches`,
      allowed: 'approver',
    },
    { method: 'get', path: '/requests', allowed: 'approver' },
    { method: 'get', path: '/listings/pending', allowed: 'approver' },
    {
      method: 'patch',
      path: `/listings/${listingId}/approve`,
      allowed: 'approver',
    },
    {
      method: 'patch',
      path: `/listings/${listingId}/reject`,
      allowed: 'approver',
    },
    {
      method: 'get',
      path: `/matching/requests/${requestId}/suggestions`,
      allowed: 'approver',
    },
    {
      method: 'post',
      path: `/matching/requests/${requestId}/suggestions`,
      allowed: 'approver',
      body: { listingId },
    },
    {
      method: 'patch',
      path: `/matching/matches/${matchId}/status`,
      allowed: 'approver',
      body: { status: 'SENT' },
    },
    { method: 'get', path: '/complaints', allowed: 'moderator' },
    {
      method: 'patch',
      path: `/complaints/${complaintId}`,
      allowed: 'moderator',
      body: { status: 'REVIEWING' },
    },
    {
      method: 'post',
      path: '/admin/permissions',
      allowed: 'manager',
      body: { email: 'member@pilot.test', canApproveListings: true },
    },
  ];
  it.each(protectedRoutes)(
    '$method $path requires the right flag, regardless of role',
    async (route) => {
      for (const token of [
        'member',
        'labelOnly',
        'approver',
        'moderator',
        'manager',
      ].filter((value) => value !== route.allowed)) {
        await call()
          [route.method](route.path)
          .auth(token, { type: 'bearer' })
          .send(route.body ?? {})
          .expect(403);
      }
      await call()
        [route.method](route.path)
        .send(route.body ?? {})
        .expect(401);
      saved = {
        locationOverrideReason: null,
        locationOverrideAdminId: null,
        locationOverrideAt: null,
        recommendationReason: null,
        recommendedByAdminId: null,
        recommendationReviewedAt: null,
        invalidatedAt: null,
        invalidationReason: null,
        id: matchId,
        listingId,
        requestId,
        score: 40,
        status: 'SUGGESTED',
        createdAt: date,
      };
      await call()
        [route.method](route.path)
        .auth(route.allowed, { type: 'bearer' })
        .send(route.body ?? {})
        .expect(route.method === 'post' ? 201 : 200);
    },
  );
  it('grants usable permission without promoting the role and exposes only own flags', async () => {
    await call()
      .post('/admin/permissions')
      .auth('manager', { type: 'bearer' })
      .send({ email: 'member@pilot.test', canApproveListings: true })
      .expect(201);
    await call()
      .get('/requests')
      .auth('member', { type: 'bearer' })
      .expect(200);
    const profile = await call()
      .get('/users/me')
      .auth('member', { type: 'bearer' })
      .expect(200);
    expect(profile.body).toMatchObject({
      role: 'RENTER',
      adminPermission: { canApproveListings: true, canManageComplaints: false },
    });
    await call()
      .post('/admin/permissions')
      .auth('manager', { type: 'bearer' })
      .send({ email: 'member@pilot.test', canApproveListings: false })
      .expect(201);
    await call()
      .get('/requests')
      .auth('member', { type: 'bearer' })
      .expect(403);
  });
  it('requires an explicit location reason and records a server-derived administrator', async () => {
    rental = {
      ...rental,
      searchLatitude: 6.9271,
      searchLongitude: 79.8612,
      searchRadiusKm: 3,
    };
    const path = `/matching/requests/${requestId}/suggestions`;
    for (const body of [
      { listingId },
      { listingId, locationOverrideReason: '  ' },
      {
        listingId,
        locationOverrideReason: 'Agreed',
        locationOverrideAdminId: 'forged',
      },
    ]) {
      await call()
        .post(path)
        .auth('approver', { type: 'bearer' })
        .send(body)
        .expect(400);
    }
    await call()
      .post(path)
      .auth('member', { type: 'bearer' })
      .send({ listingId, locationOverrideReason: 'Agreed' })
      .expect(403);
    const response = await call()
      .post(path)
      .auth('approver', { type: 'bearer' })
      .send({ listingId, locationOverrideReason: ' Renter agreed ' })
      .expect(201);
    expect(response.body).toMatchObject({
      locationOverrideReason: 'Renter agreed',
      locationOverrideAdminId: 'db-approver',
      locationOverrideAt: expect.any(String),
    });
    await call()
      .patch(`/matching/matches/${matchId}/status`)
      .auth('approver', { type: 'bearer' })
      .send({ status: 'SENT' })
      .expect(200);
    expect(saved?.locationOverrideReason).toBe('Renter agreed');
  });
  it('shows preference differences and records an authorized general recommendation review', async () => {
    listing.propertyType = 'HOUSE';
    listing.monthlyRent = 120000;
    const path = `/matching/requests/${requestId}/suggestions`;
    const suggestions = await call()
      .get(path)
      .auth('approver', { type: 'bearer' })
      .expect(200);
    expect(suggestions.body.data[0]).toMatchObject({
      listingId,
      areaMatched: true,
      requiresReview: true,
    });
    expect(suggestions.body.data[0].criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'area', status: 'matched' }),
        expect.objectContaining({ key: 'budget', status: 'different' }),
        expect.objectContaining({ key: 'propertyType', status: 'different' }),
      ]),
    );
    for (const reason of [undefined, null, '', '   ', 'a'.repeat(1001)]) {
      await call()
        .post(path)
        .auth('approver', { type: 'bearer' })
        .send({ listingId, recommendationReason: reason })
        .expect(400);
    }
    await call()
      .post(path)
      .auth('member', { type: 'bearer' })
      .send({ listingId, recommendationReason: 'Agreed' })
      .expect(403);
    await call()
      .post(path)
      .auth('approver', { type: 'bearer' })
      .send({
        listingId,
        recommendationReason: 'Agreed',
        recommendedByAdminId: 'forged',
      })
      .expect(400);
    const result = await call()
      .post(path)
      .auth('approver', { type: 'bearer' })
      .send({
        listingId,
        recommendationReason:
          ' Renter will consider a house and revised budget ',
      })
      .expect(201);
    expect(result.body).toMatchObject({
      recommendationReason: 'Renter will consider a house and revised budget',
      recommendedByAdminId: 'db-approver',
      recommendationReviewedAt: expect.any(String),
    });
    await call()
      .patch(`/matching/matches/${matchId}/status`)
      .auth('approver', { type: 'bearer' })
      .send({ status: 'SENT' })
      .expect(200);
    expect(saved?.recommendationReason).toBe(result.body.recommendationReason);
    expect(saved?.recommendedByAdminId).toBe('db-approver');
  });
  it('looks up references privately and keeps contacts out of renter messages', async () => {
    const lookup = await call()
      .get('/listings/admin/lookup/sl-000001')
      .auth('approver', { type: 'bearer' })
      .expect(200);
    expect(lookup.body).toMatchObject({
      reference: 'SL-000001',
      ownerContact: listing.ownerContact,
    });
    await call()
      .get('/listings/admin/lookup/invalid')
      .auth('approver', { type: 'bearer' })
      .expect(400);
    const candidate = await call()
      .get(`/matching/requests/${requestId}/candidates/sl-000001`)
      .auth('approver', { type: 'bearer' })
      .expect(200);
    expect(candidate.body.listing.reference).toBe('SL-000001');
    const result = await call()
      .get(`/matching/requests/${requestId}/suggestions`)
      .auth('approver', { type: 'bearer' })
      .expect(200);
    expect(result.body.data[0]).toMatchObject({
      reference: 'SL-000001',
      ownerContact: listing.ownerContact,
    });
    expect(result.body.data[0].whatsappMessage).toContain(
      'Listing ID: SL-000001',
    );
    expect(result.body.data[0].whatsappMessage).not.toContain(
      listing.ownerContact,
    );
  });
  it('allows anonymous reports and derives authenticated reporter identity', async () => {
    await call().post('/complaints').send(report).expect(201);
    expect(complaintCreate).toHaveBeenLastCalledWith({
      data: {
        targetType: 'LISTING',
        targetId: listingId,
        reason: report.reason,
      },
    });
    await call()
      .post('/complaints')
      .auth('member', { type: 'bearer' })
      .send(report)
      .expect(201);
    expect(complaintCreate).toHaveBeenLastCalledWith({
      data: {
        targetType: 'LISTING',
        targetId: listingId,
        reason: report.reason,
        reporterId: 'db-member',
      },
    });
  });
  it('rejects forged identity, invalid tokens, and a filled honeypot before saving', async () => {
    await call()
      .post('/complaints')
      .send({ ...report, reporterId: 'db-other' })
      .expect(400);
    await call()
      .post('/complaints')
      .auth('invalid', { type: 'bearer' })
      .send(report)
      .expect(401);
    app.get<ThrottlerStorageService>(ThrottlerStorage).storage.clear();
    await call()
      .post('/complaints')
      .set('Authorization', 'Basic invalid')
      .send(report)
      .expect(401);
    await call()
      .post('/complaints')
      .auth('member', { type: 'bearer' })
      .send({ ...report, website: 'spam' })
      .expect(400);
    expect(complaintCreate).not.toHaveBeenCalled();
  });
  it('validates complaint update status, notes, and ID at the HTTP boundary', async () => {
    for (const body of [
      { status: 'INVALID' },
      { status: 'RESOLVED', adminNotes: 42 },
      { adminNotes: 'missing status' },
    ]) {
      await call()
        .patch(`/complaints/${complaintId}`)
        .auth('moderator', { type: 'bearer' })
        .send(body)
        .expect(400);
    }
    await call()
      .patch('/complaints/not-a-uuid')
      .auth('moderator', { type: 'bearer' })
      .send({ status: 'OPEN' })
      .expect(400);
    expect(complaintUpdate).not.toHaveBeenCalled();
    await call()
      .patch(`/complaints/${complaintId}`)
      .auth('moderator', { type: 'bearer' })
      .send({ status: 'RESOLVED', adminNotes: 'Verified with owner' })
      .expect(200);
    expect(complaintUpdate).toHaveBeenCalledWith({
      where: { id: complaintId },
      data: { status: 'RESOLVED', adminNotes: 'Verified with owner' },
    });
  });
  it('uses a paginated pending-only queue', async () => {
    listing.status = 'PENDING_APPROVAL';
    const response = await call()
      .get('/listings/pending?limit=1')
      .auth('approver', { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({
      page: 1,
      limit: 1,
      hasNextPage: false,
      data: [{ id: listingId }],
    });
    expect(listingFind).toHaveBeenLastCalledWith({
      where: { status: 'PENDING_APPROVAL', deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 2,
    });
  });
  it('keeps GET read-only, saves explicitly, and preserves status when saved again', async () => {
    const url = `/matching/requests/${requestId}/suggestions`;
    const initial = await call()
      .get(url)
      .auth('approver', { type: 'bearer' })
      .expect(200);
    expect(initial.body).toMatchObject({
      data: [{ listingId, matchId: null, status: null }],
    });
    expect(matchUpsert).not.toHaveBeenCalled();
    await call()
      .post(url)
      .auth('approver', { type: 'bearer' })
      .send({ listingId })
      .expect(201);
    expect(saved?.status).toBe('SUGGESTED');
    for (const status of [
      'SENT',
      'INTERESTED',
      'NOT_INTERESTED',
      'RENTED',
    ] as const) {
      await call()
        .patch(`/matching/matches/${matchId}/status`)
        .auth('approver', { type: 'bearer' })
        .send({ status })
        .expect(200);
      expect(saved?.status).toBe(status);
    }
    await call()
      .post(url)
      .auth('approver', { type: 'bearer' })
      .send({ listingId })
      .expect(201);
    expect(saved?.status).toBe('RENTED');
    const result = await call()
      .get(url)
      .auth('approver', { type: 'bearer' })
      .expect(200);
    expect(result.body).toMatchObject({
      data: [{ matchId, status: 'RENTED' }],
    });
    expect(matchUpsert).toHaveBeenCalledTimes(2);
  });
  it('rejects closed requests for both lookup and explicit saving', async () => {
    rental.status = 'CLOSED';
    const url = `/matching/requests/${requestId}/suggestions`;
    await call().get(url).auth('approver', { type: 'bearer' }).expect(400);
    await call()
      .post(url)
      .auth('approver', { type: 'bearer' })
      .send({ listingId })
      .expect(400);
    expect(listingFind).not.toHaveBeenCalled();
    expect(matchUpsert).not.toHaveBeenCalled();
  });
  it('rejects invalid match status, malformed IDs, and missing matches', async () => {
    await call()
      .patch(`/matching/matches/${matchId}/status`)
      .auth('approver', { type: 'bearer' })
      .send({ status: 'MADE_UP' })
      .expect(400);
    await call()
      .patch('/matching/matches/invalid/status')
      .auth('approver', { type: 'bearer' })
      .send({ status: 'SENT' })
      .expect(400);
    await call()
      .patch(`/matching/matches/${matchId}/status`)
      .auth('approver', { type: 'bearer' })
      .send({ status: 'SENT' })
      .expect(404);
    await call()
      .post(`/matching/requests/${requestId}/suggestions`)
      .auth('approver', { type: 'bearer' })
      .send({ listingId: 'invalid' })
      .expect(400);
    expect(matchUpdate).not.toHaveBeenCalled();
    expect(matchUpsert).not.toHaveBeenCalled();
  });
  it('rechecks hard requirements before saving a stale suggestion', async () => {
    listing.parking = false;
    await call()
      .post(`/matching/requests/${requestId}/suggestions`)
      .auth('approver', { type: 'bearer' })
      .send({ listingId })
      .expect(400);
    expect(matchUpsert).not.toHaveBeenCalled();
  });
});
