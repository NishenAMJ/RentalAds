import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import type { PayhereNotification } from './payhere.service';

@ApiTags('payments')
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
