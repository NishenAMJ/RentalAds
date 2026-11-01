import { Suspense } from "react";
import type { Metadata } from "next";
import { ReturnStatus } from "./return-status";

export const metadata: Metadata = { title: "Booking payment", robots: { index: false } };

export default function BookingReturnPage() {
  return <Suspense fallback={<p role="status">…</p>}><ReturnStatus /></Suspense>;
}
