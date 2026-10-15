import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import {
  availabilityPolicy,
  cutoffDate,
  unconfirmedSince,
} from './availability';

const BATCH_SIZE = 100;
const MAX_BATCHES = 50;
const FIRST_RUN_DELAY_MS = 60_000;
const RUN_EVERY_MS = 60 * 60 * 1000;

@Injectable()
export class AvailabilityReminderService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AvailabilityReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private timers: NodeJS.Timeout[] = [];

  /**
   * Checks hourly. Each reminder is claimed in the database before it is sent,
   * so frequent or concurrent runs (several API instances) never duplicate one.
   * Disabled under test and when DISABLE_SCHEDULER=true.
   */
  onApplicationBootstrap(): void {
    if (
      this.config.get<string>('NODE_ENV') === 'test' ||
      this.config.get<string>('DISABLE_SCHEDULER') === 'true'
    )
      return;
    const first = setTimeout(() => void this.runOnce(), FIRST_RUN_DELAY_MS);
    const repeat = setInterval(() => void this.runOnce(), RUN_EVERY_MS);
    // Never keep the process alive just for housekeeping.
    first.unref();
    repeat.unref();
    this.timers.push(first, repeat);
  }

  onApplicationShutdown(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  async runOnce(): Promise<void> {
    try {
      const sent = await this.sendReminders(new Date());
      if (sent) this.logger.log(`Sent ${sent} availability reminders`);
    } catch (cause) {
      this.logger.error(`Availability reminders failed: ${String(cause)}`);
    }
  }

  /** Reminds owners of active listings that have not been confirmed recently. Returns how many were sent. */
  async sendReminders(now: Date): Promise<number> {
    const { staleDays, reminderDays } = availabilityPolicy(this.config);
    const cutoff = cutoffDate(now, reminderDays);
    let sent = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const due = await this.prisma.listing.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          reminderSentAt: null,
          AND: [unconfirmedSince(cutoff)],
        },
        select: { id: true, ownerId: true, reference: true, areaText: true },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
      });
      if (!due.length) break;
      for (const listing of due) {
        const claimed = await this.prisma.$transaction(async (tx) => {
          // Claiming first means a concurrent run cannot send a duplicate.
          const claim = await tx.listing.updateMany({
            where: { id: listing.id, reminderSentAt: null },
            data: { reminderSentAt: now },
          });
          if (!claim.count) return false;
          await tx.notification.create({
            data: {
              userId: listing.ownerId,
              type: 'AVAILABILITY_REMINDER',
              title: 'Is your property still available?',
              message: `Please confirm that ${listing.reference ?? listing.areaText} is still available. Properties that are not confirmed within ${staleDays} days are hidden from public browsing.`,
            },
          });
          return true;
        });
        if (claimed) sent++;
      }
    }
    return sent;
  }
}
