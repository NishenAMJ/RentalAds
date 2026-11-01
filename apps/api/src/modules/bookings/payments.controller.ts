import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import type { PayhereNotification } from './payhere.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly bookings: BookingsService) {}

  /** PayHere calls this after every payment attempt. It is public by design; the signature is the authentication. */
  @Post('payhere/notify')
  @HttpCode(200)
  async notify(@Body() body: PayhereNotification) {
    await this.bookings.handlePayhereNotification(body);
    return 'OK';
  }
}
