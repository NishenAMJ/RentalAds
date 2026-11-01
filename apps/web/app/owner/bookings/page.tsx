import type { Metadata } from "next";
import { BookingList } from "@/components/booking-list";

export const metadata: Metadata = { title: "Bookings of my items", robots: { index: false } };

export default function OwnerBookingsPage() {
  return <BookingList viewer="owner" />;
}
