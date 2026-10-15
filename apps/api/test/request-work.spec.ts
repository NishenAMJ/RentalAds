/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestsService } from '../src/modules/RequestsModule/requests.service';
import {
  AdminRequestQuery,
  UpdateRequestWorkDto,
} from '../src/modules/RequestsModule/request-work.dto';
import {
  INTERNAL_REQUEST_FIELDS,
  forRenter,
} from '../src/modules/RequestsModule/request-view';

const internal = {
  adminNotes: 'Fussy about parking',
  assignedAdminId: 'admin-1',
  assignedAt: new Date(),
  followUpAt: new Date(),
  assignedAdmin: { id: 'admin-1', email: 'staff@example.test' },
};
const row = {
  id: 'r1',
  renterId: 'renter',
  areaText: 'Colombo 5',
  ...internal,
};

describe('forRenter', () => {
  it('removes every internal field and keeps the renter-visible ones', () => {
    const view = forRenter(row);
    for (const field of INTERNAL_REQUEST_FIELDS)
      expect(view).not.toHaveProperty(field);
    expect(view).toEqual({
      id: 'r1',
      renterId: 'renter',
      areaText: 'Colombo 5',
    });
  });

  it('does not modify the original row', () => {
    forRenter(row);
    expect(row.adminNotes).toBe('Fussy about parking');
  });
});

describe('renter-facing request responses never expose internal notes', () => {
  const prisma = {
    rentalRequest: {
      create: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
      findUnique: jest
        .fn()
        .mockResolvedValue({ ...row, deletedAt: null, renterId: 'renter' }),
      update: jest.fn().mockResolvedValue(row),
    },
  };
  const service = new RequestsService(prisma as never);

  it.each([
    [
      'create',
      () =>
        service.create('renter', {
          budgetMax: 100,
          durationMonths: 12,
        } as never),
    ],
    [
      'findMine',
      async () =>
        (await service.findMine('renter', { page: 1, limit: 20 })).data[0],
    ],
    ['close', () => service.close('renter', 'r1')],
  ])('%s', async (_name, call) => {
    const result = await call();
    expect(JSON.stringify(result)).not.toMatch(
      /adminNotes|assignedAdmin|followUp|staff@example/,
    );
  });
});

describe('RequestsService.updateWork', () => {
  const live = { id: 'r1', deletedAt: null };
  function build(found: object | null = live) {
    const prisma = {
      rentalRequest: {
        findUnique: jest.fn().mockResolvedValue(found),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
    };
    return { prisma, service: new RequestsService(prisma as never) };
  }
  const updateData = (prisma: ReturnType<typeof build>['prisma']) =>
    (
      prisma.rentalRequest.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ]
    )[0].data;

  it('assigns to the calling admin, using their database id', async () => {
    const { prisma, service } = build();
    await service.updateWork('auth-1', 'r1', { assignToMe: true });
    expect(updateData(prisma)).toMatchObject({ assignedAdminId: 'admin-1' });
    expect(updateData(prisma).assignedAt).toBeInstanceOf(Date);
  });

  it('unassigns, trims notes, clears empty notes and sets or clears the follow-up date', async () => {
    const first = build();
    await first.service.updateWork('auth-1', 'r1', {
      unassign: true,
      adminNotes: '  call back Tuesday  ',
      followUpAt: '2026-11-01T00:00:00.000Z',
    });
    expect(updateData(first.prisma)).toEqual({
      assignedAdminId: null,
      assignedAt: null,
      adminNotes: 'call back Tuesday',
      followUpAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    const second = build();
    await second.service.updateWork('auth-1', 'r1', {
      adminNotes: '   ',
      followUpAt: null,
    });
    expect(updateData(second.prisma)).toEqual({
      adminNotes: null,
      followUpAt: null,
    });
  });

  it('rejects contradictory or empty updates and deleted or missing requests', async () => {
    await expect(
      build().service.updateWork('a', 'r1', {
        assignToMe: true,
        unassign: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build().service.updateWork('a', 'r1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build({ ...live, deletedAt: new Date() }).service.updateWork('a', 'r1', {
        adminNotes: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(null).service.updateWork('a', 'r1', { adminNotes: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RequestsService.findAllForAdmin filters', () => {
  function build(user: object | null = { id: 'admin-1' }) {
    const prisma = {
      rentalRequest: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue(user) },
    };
    return { prisma, service: new RequestsService(prisma as never) };
  }
  const whereOf = (prisma: ReturnType<typeof build>['prisma']) =>
    (prisma.rentalRequest.findMany.mock.calls[0] as [{ where: object }])[0]
      .where;
  const query = (extra: object): AdminRequestQuery =>
    plainToInstance(AdminRequestQuery, { page: 1, limit: 20, ...extra });

  it('shows everything that is not deleted by default', async () => {
    const { prisma, service } = build();
    await service.findAllForAdmin(query({}));
    expect(whereOf(prisma)).toEqual({ deletedAt: null });
  });

  it('can show only the caller’s requests, only unassigned ones, and by status', async () => {
    const mine = build();
    await mine.service.findAllForAdmin(
      query({ assigned: 'me', status: 'OPEN' }),
      'auth-1',
    );
    expect(whereOf(mine.prisma)).toEqual({
      deletedAt: null,
      status: 'OPEN',
      assignedAdminId: 'admin-1',
    });
    const free = build();
    await free.service.findAllForAdmin(query({ assigned: 'unassigned' }));
    expect(whereOf(free.prisma)).toEqual({
      deletedAt: null,
      assignedAdminId: null,
    });
  });

  it('returns nothing for "mine" when the caller is unknown', async () => {
    const { prisma, service } = build(null);
    await service.findAllForAdmin(query({ assigned: 'me' }), 'ghost');
    expect(whereOf(prisma)).toMatchObject({ assignedAdminId: '' });
  });
});

describe('work queue DTO validation', () => {
  const check = (body: object) =>
    validate(plainToInstance(UpdateRequestWorkDto, body));

  it.each([
    { assignToMe: true },
    { adminNotes: 'ok', followUpAt: '2026-11-01' },
    { followUpAt: null },
  ])('accepts %j', async (body) => {
    expect(await check(body)).toHaveLength(0);
  });

  it.each([
    { assignToMe: 'yes' },
    { adminNotes: 'x'.repeat(2001) },
    { followUpAt: 'tomorrow' },
    { adminNotes: 42 },
  ])('rejects %j', async (body) => {
    expect((await check(body)).length).toBeGreaterThan(0);
  });
});
