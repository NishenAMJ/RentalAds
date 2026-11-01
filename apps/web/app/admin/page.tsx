"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { AdminPermissionsForm } from "@/components/admin-permissions-form";
import { apiRequest } from "@/lib/api-client";
import type { AdminSummary } from "@/lib/admin-listings";

function SummaryCard({ title, href, cta, rows }: { title: string; href: string; cta: string; rows: [label: string, value: number][] }) {
  return <article className="panel summary-card">
    <h2>{title}</h2>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <Link className="button" href={href}>{cta} →</Link>
  </article>;
}

/** Overview only counts and links; the work itself happens on the listings, requests and complaints pages. */
export default function AdminDashboard() {
  const { permissions, user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<AdminSummary>("/admin/summary", { authenticated: true, signal: controller.signal })
      .then(setSummary)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load the overview.");
      });
    return () => controller.abort();
  }, []);
  const { listings, requests, bookings, complaints } = summary ?? {};
  let counts: ReactNode = <p role="status">Loading overview...</p>;
  if (error) counts = <p role="alert" className="notice error">{error}</p>;
  else if (summary) counts = <div className="admin-summary">
    {listings && <SummaryCard title="Listings" href="/admin/listings" cta="Review listings"
      rows={[["Waiting for review", listings.pending], ["Live", listings.active], ["Switched off", listings.inactive]]} />}
    {requests && <SummaryCard title="Rental requests" href="/admin/requests" cta="Manage requests"
      rows={[["Open", requests.open], ["Not yet assigned", requests.unassigned]]} />}
    {bookings && <SummaryCard title="Bookings" href="/admin/bookings" cta="Review bookings"
      rows={[["Upcoming and paid", bookings.upcoming], ["Refunds to make", bookings.refundDue]]} />}
    {complaints && <SummaryCard title="Complaints" href="/admin/complaints" cta="Review complaints"
      rows={[["Open", complaints.open]]} />}
  </div>;
  return <section className="admin-dashboard">
    <div className="admin-heading"><div>
      <p className="eyebrow">RentalHub Sri Lanka / Administration</p>
      <h1>Your platform at a glance.</h1>
      <p>See what needs attention, then open the right area to act on it.</p>
    </div><span className="admin-account">Signed in as <strong>{user?.email ?? "Administrator"}</strong></span></div>
    {counts}
    {permissions.canManageAdmins && <AdminPermissionsForm />}
  </section>;
}
