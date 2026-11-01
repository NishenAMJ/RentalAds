import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const md5Upper = (value: string) =>
  createHash('md5').update(value).digest('hex').toUpperCase();

/** Hash PayHere expects on the checkout form: merchant id, order id, amount, currency, then the hashed secret. */
export function checkoutHash(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  secret: string,
) {
  return md5Upper(
    `${merchantId}${orderId}${amount}${currency}${md5Upper(secret)}`,
  );
}

/** Signature PayHere sends with its payment notification; compare it before trusting any field. */
export function notificationSignature(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  statusCode: string,
  secret: string,
) {
  return md5Upper(
    `${merchantId}${orderId}${amount}${currency}${statusCode}${md5Upper(secret)}`,
  );
}

export interface PayhereNotification {
  merchant_id?: string;
  order_id?: string;
  payment_id?: string;
  payhere_amount?: string;
  payhere_currency?: string;
  status_code?: string;
  md5sig?: string;
}

export interface CheckoutRequest {
  /** Where the browser should POST the fields. */
  action: string;
  fields: Record<string, string>;
}

/** Builds PayHere checkout forms and verifies its payment notifications. Needs PAYHERE_MERCHANT_ID and _SECRET. */
@Injectable()
export class PayhereService {
  constructor(private readonly config: ConfigService) {}

  private credentials() {
    const merchantId = this.config.get<string>('PAYHERE_MERCHANT_ID');
    const secret = this.config.get<string>('PAYHERE_MERCHANT_SECRET');
    if (!merchantId || !secret)
      throw new ServiceUnavailableException(
        'Online payments are not set up yet',
      );
    return { merchantId, secret };
  }

  checkout(
    booking: { id: string; totalAmount: number },
    buyer: { email: string; phone: string },
    itemName: string,
  ): CheckoutRequest {
    const { merchantId, secret } = this.credentials();
    const frontend = (
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const apiPublic = (
      this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001'
    ).replace(/\/$/, '');
    const amount = booking.totalAmount.toFixed(2);
    const sandbox = this.config.get<string>('PAYHERE_SANDBOX') !== 'false';
    return {
      action: sandbox
        ? 'https://sandbox.payhere.lk/pay/checkout'
        : 'https://www.payhere.lk/pay/checkout',
      fields: {
        merchant_id: merchantId,
        return_url: `${frontend}/bookings/return?booking=${booking.id}`,
        cancel_url: `${frontend}/bookings`,
        notify_url: `${apiPublic}/payments/payhere/notify`,
        order_id: booking.id,
        items: itemName.slice(0, 100),
        currency: 'LKR',
        amount,
        first_name: 'Renter',
        last_name: 'RentalHub',
        email: buyer.email,
        phone: buyer.phone,
        address: 'Sri Lanka',
        city: 'Sri Lanka',
        country: 'Sri Lanka',
        hash: checkoutHash(merchantId, booking.id, amount, 'LKR', secret),
      },
    };
  }

  /** True only when the notification was signed with our merchant secret. */
  verify(body: PayhereNotification): boolean {
    const { merchantId, secret } = this.credentials();
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    } = body;
    if (
      !md5sig ||
      merchant_id !== merchantId ||
      !order_id ||
      !payhere_amount ||
      !payhere_currency ||
      !status_code
    )
      return false;
    return (
      notificationSignature(
        merchant_id,
        order_id,
        payhere_amount,
        payhere_currency,
        status_code,
        secret,
      ) === md5sig.toUpperCase()
    );
  }
}
