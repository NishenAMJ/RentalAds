import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Listing, RentalRequest } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { CLOUDINARY } from '../src/modules/cloudinary/cloudinary.provider';
import { configureApp } from '../src/configure-app';
import { matchesWhere } from './helpers/match-where';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: (token: string) =>
        Promise.resolve({
          data: {
            user: ['admin', 'owner'].includes(token)
              ? { id: token, email: `${token}@test.example` }
              : null,
          },
          error: null,
        }),
    },
  }),
}));

type Result = {
  data: { id?: string; listingId?: string; score?: number }[];
  page: number;
  limit: number;
  hasNextPage: boolean;
};
type Args = {
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
  cursor?: { id: string };
  orderBy?: unknown;
};
const date = new Date('2026-01-01');
const base: Listing = {
  reference: 'SL-000001',
  id: 'a',
  ownerId: 'db-owner',
  propertyType: 'HOUSE',
  size: 'N_A',
  bedrooms: 2,
  bathrooms: 1,
  parking: false,
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
  photoUrls: [],
  status: 'ACTIVE',
  // Confirmed recently, so the listing is publicly visible.
  lastAvailabilityConfirmedAt: new Date(),
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  deletedByAdminId: null,
  deletionReason: null,
  reminderSentAt: null,
};
const rental: RentalRequest = {
  searchLatitude: null,
  searchLongitude: null,
  searchRadiusKm: null,
  id: 'request-1',
  renterId: 'db-owner',
  propertyType: 'HOUSE',
  size: null,
  bedrooms: 2,
  parking: null,
  furnishing: null,
  areaText: 'Galle',
  budgetMin: 0,
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

// Real HTTP routes/guards/query validation; all persistence is in-memory.
describe('Collection pagination', () => {
  let app: INestApplication<App>;
  let listings: Listing[];
  const paginate = <T extends { id: string }>(rows: T[], args: Args): T[] => {
    const filtered = rows.filter((row) =>
      matchesWhere(row as Record<string, unknown>, args.where),
    );
    filtered.sort((a, b) =>
      Array.isArray(args.orderBy)
        ? b.id.localeCompare(a.id)
        : a.id.localeCompare(b.id),
    );
    const start = args.cursor
      ? filtered.findIndex((row) => row.id === args.cursor?.id) +
        (args.skip ?? 0)
      : (args.skip ?? 0);
    return filtered.slice(start, start + (args.take ?? filtered.length));
  };
  const listingFind = jest.fn((args: Args) =>
    Promise.resolve(paginate(listings, args)),
  );
  const requestFind = jest.fn((args: Args) =>
    Promise.resolve(
      paginate(
        ['a', 'b', 'c'].map((id) => ({ ...rental, id })),
        args,
      ),
    ),
  );
  const complaintFind = jest.fn((args: Args) =>
    Promise.resolve(
      paginate(
        ['a', 'b', 'c'].map((id) => ({ id, createdAt: date })),
        args,
      ),
    ),
  );
  const upsert = jest.fn(() => Promise.resolve({}));
  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
    const account = (id: string) => ({
      id: `db-${id}`,
      authUserId: id,
      role: id === 'admin' ? 'ADMIN' : 'OWNER',
      adminPermission: {
        canApproveListings: id === 'admin',
        canManageComplaints: id === 'admin',
      },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findUnique: ({ where }: { where: { authUserId: string } }) =>
            Promise.resolve(account(where.authUserId)),
          upsert: ({ where }: { where: { authUserId: string } }) =>
            Promise.resolve(account(where.authUserId)),
        },
        listing: { findMany: listingFind },
        rentalRequest: {
          findMany: requestFind,
          findUnique: () => Promise.resolve(rental),
        },
        complaint: { findMany: complaintFind },
        match: { upsert, findMany: () => Promise.resolve([]) },
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
    listings = ['a', 'b', 'c'].map((id) => ({ ...base, id }));
  });
  afterAll(async () => {
    await app.close();
  });
  const paths = [
    '/listings',
    '/listings/mine',
    '/requests',
    '/requests/mine',
    '/complaints',
    '/matching/requests/11111111-1111-4111-8111-111111111111/suggestions',
  ];
  const get = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .auth(
        url.startsWith('/listings/mine') || url.startsWith('/requests/mine')
          ? 'owner'
          : 'admin',
        { type: 'bearer' },
      );
  it.each(paths)(
    '%s returns defaults and paginates through to an empty page',
    async (path) => {
      const defaults = await get(path).expect(200);
      expect(defaults.body).toMatchObject({
        page: 1,
        limit: 20,
        hasNextPage: false,
      });
      const first = (await get(`${path}?page=1&limit=2`).expect(200))
        .body as Result;
      const second = (await get(`${path}?page=2&limit=2`).expect(200))
        .body as Result;
      const empty = (await get(`${path}?page=3&limit=2`).expect(200))
        .body as Result;
      expect(first.data).toHaveLength(2);
      expect(first.hasNextPage).toBe(true);
      expect(second.data).toHaveLength(1);
      expect(second.hasNextPage).toBe(false);
      expect(
        new Set(
          [...first.data, ...second.data].map(
            (item) => item.id ?? item.listingId,
          ),
        ).size,
      ).toBe(3);
      expect(empty).toEqual({
        data: [],
        page: 3,
        limit: 2,
        hasNextPage: false,
      });
    },
  );
  it.each(paths)('%s rejects invalid bounds and query values', async (path) => {
    for (const query of [
      'page=0',
      'page=-1',
      'page=1.5',
      'page=abc',
      'page=1000001',
      'limit=0',
      'limit=101',
      'limit=NaN',
      'limit=',
      'page=1&page=2',
    ]) {
      await get(`${path}?${query}`).expect(400);
    }
    expect(listingFind).not.toHaveBeenCalled();
    expect(requestFind).not.toHaveBeenCalled();
    expect(complaintFind).not.toHaveBeenCalled();
  });
  it('keeps private ownership and public visibility filters at the database', async () => {
    await get('/listings/mine?page=2&limit=2').expect(200);
    expect(listingFind).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { ownerId: 'db-owner', deletedAt: null },
        skip: 2,
        take: 3,
      }),
    );
    await get('/requests/mine?page=2&limit=2').expect(200);
    expect(requestFind).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { renterId: 'db-owner', deletedAt: null },
        skip: 2,
        take: 3,
      }),
    );
    listings.push({ ...base, id: 'private', status: 'PENDING_APPROVAL' });
    const response = (await get('/listings?limit=100').expect(200))
      .body as Result;
    expect(response.data).toHaveLength(3);
    expect(JSON.stringify(response)).not.toContain('ownerContact');
    expect(listingFind).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          category: 'PROPERTY',
          deletedAt: null,
          AND: [expect.any(Object)],
        },
        take: 101,
      }),
    );
  });
  it('hides listings whose owner has not confirmed availability recently', async () => {
    listings.push({
      ...base,
      id: 'lapsed',
      lastAvailabilityConfirmedAt: new Date('2026-01-02'),
    });
    const response = (await get('/listings?limit=100').expect(200))
      .body as Result;
    expect(response.data.map((item) => item.id)).not.toContain('lapsed');
    expect(response.data).toHaveLength(3);
  });
  it('retains admin authorization on paginated collections', async () => {
    for (const path of [
      '/requests',
      '/complaints',
      '/matching/requests/11111111-1111-4111-8111-111111111111/suggestions',
    ]) {
      await request(app.getHttpServer()).get(`${path}?page=2`).expect(401);
      await request(app.getHttpServer())
        .get(`${path}?page=2`)
        .auth('owner', { type: 'bearer' })
        .expect(403);
    }
  });
  it('ranks across candidate batches without persisting matches on GET', async () => {
    listings = Array.from({ length: 251 }, (_, i) => ({
      ...base,
      id: String(i).padStart(4, '0'),
      monthlyRent: i === 250 ? 10000 : 90000,
    }));
    const result = (
      await get(
        '/matching/requests/11111111-1111-4111-8111-111111111111/suggestions?limit=2',
      ).expect(200)
    ).body as Result;
    expect(result.data.map((item) => item.listingId)).toEqual(['0250', '0000']);
    expect(result.hasNextPage).toBe(true);
    expect(listingFind).toHaveBeenCalledTimes(2);
    expect(listingFind).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 250, cursor: { id: '0249' }, skip: 1 }),
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});
