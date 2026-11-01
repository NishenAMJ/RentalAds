import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

const SEND_TIMEOUT_MS = 8000;

/**
 * Sends plain-text email through Resend (https://resend.com). Needs RESEND_API_KEY and EMAIL_FROM; without them
 * it does nothing, so the rest of the app, which also records in-site notifications, keeps working.
 * Failures are logged and never thrown: an email problem must not undo a booking or an approval.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(
      this.config.get<string>('RESEND_API_KEY') &&
      this.config.get<string>('EMAIL_FROM'),
    );
  }

  async send(email: Email): Promise<void> {
    if (!this.enabled) return;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.get<string>('EMAIL_FROM'),
          to: [email.to],
          subject: email.subject,
          text: email.text,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok)
        this.logger.warn(`Email provider answered ${response.status}`);
    } catch (cause) {
      this.logger.warn(
        `Email could not be sent: ${cause instanceof Error ? cause.message : 'unknown error'}`,
      );
    }
  }
}
