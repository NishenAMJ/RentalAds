import { en, type MessageKey } from "./i18n/messages.ts";

export type RatePeriod = "DAY" | "WEEK" | "MONTH";

/** Mirrors the API's category registry (GET /categories), which is the source of truth for fields. */
export interface FieldOption { value: string; labelKey: string }
export interface FieldDefinition {
  key: string;
  type: "select" | "number" | "boolean" | "text";
  labelKey: string;
  required: boolean;
  options?: FieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
}
export interface CategoryDefinition {
  id: string;
  flow: "CONCIERGE" | "BOOKING";
  ratePeriods: RatePeriod[];
  fields: FieldDefinition[];
  typeField?: string;
}

/** A vehicle, piece of equipment or event gear as the public sees it. */
export interface ItemListing {
  id: string;
  reference?: string | null;
  category: string;
  title: string | null;
  description: string | null;
  attributes: Record<string, string | number | boolean> | null;
  depositAmount: number | null;
  areaText: string;
  mapLink: string | null;
  approximateLocation?: { latitude: number; longitude: number } | null;
  monthlyRent: number;
  ratePeriod: RatePeriod;
  photoUrls: string[];
  lastAvailabilityConfirmedAt: string | null;
  createdAt: string;
}

export type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export interface BookingView {
  id: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  units: number;
  ratePeriod: RatePeriod;
  rateAmount: number;
  rentalTotal: number;
  serviceFee: number;
  depositAmount: number;
  totalAmount: number;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  listing: { id: string; reference: string | null; category: string; title: string | null; areaText: string; photoUrl: string | null };
  ownerContact?: string;
  renterContact?: string;
  cancelledBy?: "RENTER" | "OWNER" | "ADMIN" | "SYSTEM" | null;
  cancelReason?: string | null;
  refundAmount?: number;
  refundStatus?: "NONE" | "DUE" | "DONE";
  paymentReference?: string | null;
  refundReference?: string | null;
  refundDue?: boolean;
}

/** What a renter gets back if they cancel now, from GET /bookings/:id/cancel-quote. */
export interface CancelQuote { rule: "UNPAID" | "FULL" | "PARTIAL" | "DEPOSIT_ONLY"; refundAmount: number; daysBeforeStart: number }

/** A chat link for a Sri Lankan number such as +94771234567. */
export const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

/** Today in Sri Lanka as YYYY-MM-DD, to compare with the API's dates. */
export const todayInSriLanka = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

export interface BookingQuote {
  days: number;
  ratePeriod: RatePeriod;
  rateAmount: number;
  units: number;
  rentalTotal: number;
  serviceFee: number;
  depositAmount: number;
  totalAmount: number;
}

export interface CheckoutRequest { action: string; fields: Record<string, string> }

export const hasMessage = (key: string): key is MessageKey => key in en;

/** Translates a key that came from the API; shows the key itself rather than crashing if the web has no text for it yet. */
export function labelFor(t: (key: MessageKey) => string, key: string): string {
  return hasMessage(key) ? t(key) : key;
}

/** Whole-rupee amount, for example "LKR 26,500". */
export const lkr = (amount: number) => `LKR ${amount.toLocaleString("en-LK")}`;
