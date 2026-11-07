import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type {
  CreateOwnerPayoutDto,
  RecordOwnerPayoutDto,
} from './dto/owner-payout.dto';
import { AdminActivityService } from './admin-activity.service';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class OwnerPayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: AdminActivityService,
  ) {}

  async list(status?: string) {
    if (status && !['DUE', 'PAID', 'CANCELLED'].includes(status))
      throw new BadRequestException('Invalid payout status');
    const rows = await this.prisma.ownerPayout.findMany({
      ...(status
        ? { where: { status: status as 'DUE' | 'PAID' | 'CANCELLED' } }
        : {}),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        owner: { select: { id: true, email: true, phone: true } },
        booking: {
          select: {
            id: true,
            status: true,
            paidAt: true,
            startDate: true,
            endDate: true,
            paymentReference: true,
            listing: {
              select: {
                reference: true,
                title: true,
                category: true,
                areaText: true,
              },
            },
            ownerPayout: { select: { id: true } },
          },
        },
      },
    });
    return rows.map(({ owner, booking, ...row }) => ({
      ...row,
      owner: { ...owner, phone: null },
      booking: { ...booking, payoutExists: Boolean(booking.ownerPayout) },
    }));
  }

  async create(authUserId: string, dto: CreateOwnerPayoutDto) {
    const [admin, booking] = await Promise.all([
      this.prisma.user.findUnique({
        where: { authUserId },
        select: { id: true },
      }),
      this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: {
          listing: { select: { ownerId: true } },
          ownerPayout: { select: { id: true } },
        },
      }),
    ]);
    if (!admin) throw new NotFoundException('Admin account not found');
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'COMPLETED')
      throw new BadRequestException(
        'Only completed bookings can have an owner payout',
      );
    if (!booking.paidAt)
      throw new BadRequestException(
        'Booking must be paid before a payout is recorded',
      );
    if (booking.listing.ownerId === booking.renterId)
      throw new BadRequestException(
        'A renter cannot receive an owner payout for their own booking',
      );
    if (booking.ownerPayout)
      throw new ConflictException(
        'A payout record already exists for this booking',
      );
    try {
      const payout = await this.prisma.ownerPayout.create({
        data: {
          bookingId: booking.id,
          ownerId: booking.listing.ownerId,
          amount: dto.amount,
          note: dto.note?.trim() || null,
          createdById: admin.id,
        },
      });
      await this.activity.record(
        authUserId,
        'OWNER_PAYOUT_CREATED',
        'PAYOUT',
        payout.id,
        'Owner payout created',
      );
      return payout;
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'A payout record already exists for this booking',
        );
      throw error;
    }
  }

  async markPaid(authUserId: string, id: string, dto: RecordOwnerPayoutDto) {
    const payout = await this.prisma.ownerPayout.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== 'DUE')
      throw new ConflictException('Only due payouts can be marked paid');
    const updated = await this.prisma.ownerPayout.updateMany({
      where: { id, status: 'DUE' },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        transferReference: dto.transferReference.trim(),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
      },
    });
    if (!updated.count)
      throw new ConflictException(
        'Payout status changed; refresh and try again',
      );
    const result = await this.prisma.ownerPayout.findUnique({ where: { id } });
    await this.activity.record(
      authUserId,
      'OWNER_PAYOUT_PAID',
      'PAYOUT',
      id,
      'Owner payout marked paid',
    );
    return result;
  }
}
