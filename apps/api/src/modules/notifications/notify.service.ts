import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MailerService } from './mailer.service';

export interface Alert {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Page the person should open next, for example /bookings. Defaults to the notifications inbox. */
  link?: string;
}

/**
 * Tells people about something that happened: always an in-site notification, plus an email when the mailer is set up.
 * Never throws, so a notification problem cannot undo the booking, approval or cancellation that caused it.
 */
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async send(alerts: Alert[]): Promise<void> {
    if (!alerts.length) return;
    try {
      await this.prisma.notification.createMany({
        data: alerts.map(({ userId, type, title, message }) => ({
          userId,
          type,
          title,
          message,
        })),
      });
    } catch (cause) {
      this.logger.warn(
        `Notifications could not be saved: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      );
    }
    // Email is slow and optional, so callers (including PayHere's webhook) do not wait for it.
    if (this.mailer.enabled) void this.email(alerts);
  }

  private async email(alerts: Alert[]): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: [...new Set(alerts.map((alert) => alert.userId))] },
        },
        select: { id: true, email: true },
      });
      const emailOf = new Map(users.map((user) => [user.id, user.email]));
      const site = (
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
      ).replace(/\/$/, '');
      await Promise.allSettled(
        alerts.flatMap((alert) => {
          const to = emailOf.get(alert.userId);
          return to
            ? [
                this.mailer.send({
                  to,
                  subject: alert.title,
                  text: `${alert.message}\n\n${site}${alert.link ?? '/notifications'}\n\n— RentalHub Sri Lanka`,
                }),
              ]
            : [];
        }),
      );
    } catch (cause) {
      this.logger.warn(
        `Emails could not be prepared: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      );
    }
  }
}
