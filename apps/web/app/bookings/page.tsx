import type { Metadata } from "next";
import { BookingList } from "@/components/booking-list";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default function BookingsPage() {
  return <BookingList viewer="renter" />;
}
