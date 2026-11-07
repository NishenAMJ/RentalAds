"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { AdminPermissionsForm } from "@/components/admin-permissions-form";
import { apiRequest } from "@/lib/api-client";
import type { AdminSummary } from "@/lib/admin-listings";

type AttentionItem = { key: string; label: string; count: number; detail: string; href: string; action: string };

function SummaryCard({ title, href, cta, rows }: { title: string; href: string; cta: string; rows: [label: string, value: number | string][] }) {
  return <article className="panel summary-card">
    <h2>{title}</h2>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <Link className="button" href={href}>{cta} →</Link>
  </article>;
}

function attentionItems(summary: AdminSummary): AttentionItem[] {
  return [
    summary.listings && { key: "listings", label: "Listings awaiting review", count: summary.listings.pending, detail: "Review new submissions before they appear publicly.", href: "/admin/listings", action: "Review listings" },
    summary.requests && { key: "requests", label: "Unassigned home requests", count: summary.requests.unassigned, detail: "Assign requests so renters receive follow-up.", href: "/admin/requests", action: "Assign requests" },
    summary.bookings && { key: "refunds", label: "Refunds to record", count: summary.bookings.refundDue, detail: "Process refunds with your payment provider, then record the reference.", href: "/admin/bookings", action: "Review refunds" },
    summary.complaints && { key: "complaints", label: "Open complaints", count: summary.complaints.open, detail: "Review reports and update their status or notes.", href: "/admin/complaints", action: "Review complaints" },
    summary.payouts && { key: "payouts", label: "Owner payouts due", count: summary.payouts.dueCount, detail: `Manually transfer and record ${summary.payouts.dueAmount.toLocaleString("en-LK")} LKR when the amount is confirmed.`, href: "/admin/payouts", action: "Review payouts" },
    summary.commissions && { key: "commissions", label: "Property commissions due", count: summary.commissions.dueCount, detail: `Invoice or record payment for ${summary.commissions.dueAmount.toLocaleString("en-LK")} LKR in outstanding commissions.`, href: "/admin/commissions", action: "Review commissions" },
  ].filter((item): item is AttentionItem => Boolean(item && item.count > 0));
}

/** An operational overview of the work this admin is permitted to manage. */
export default function AdminDashboard() {
  const { permissions, user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<AdminSummary>("/admin/summary", { authenticated: true, signal: controller.signal })
      .then((result) => {
        setSummary(result);
        setError("");
        setLastUpdated(new Date());
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load the overview.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reloadKey]);

  const items = summary ? attentionItems(summary) : [];
  let counts: ReactNode = <p role="status">Loading overview…</p>;
  if (error) counts = <div className="notice error" role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setLoading(true); setReloadKey((key) => key + 1); }}>Retry</button></div>;
  else if (!loading && summary) counts = <>
    <section className="admin-attention panel" aria-labelledby="admin-attention-title">
      <div className="admin-attention-heading"><div><p className="eyebrow">Work queue</p><h2 id="admin-attention-title">Needs attention</h2></div>{lastUpdated && <p className="small-copy">Updated {lastUpdated.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" })}</p>}</div>
      {items.length ? <ul className="admin-attention-list">{items.map((item) => <li key={item.key}>
        <div className="admin-attention-count" aria-label={`${item.count} items`}>{item.count}</div>
        <div className="admin-attention-copy"><h3>{item.label}</h3><p>{item.detail}</p></div>
        <Link className="button" href={item.href}>{item.action} →</Link>
      </li>)}</ul> : <p className="admin-attention-empty" role="status">There are no outstanding actions in the areas you can manage.</p>}
    </section>
    <div className="admin-summary">
      {summary.listings && <SummaryCard title="Listings" href="/admin/listings" cta="Manage listings" rows={[["Waiting for review", summary.listings.pending], ["Live", summary.listings.active], ["Switched off", summary.listings.inactive]]} />}
      {summary.requests && <SummaryCard title="Rental requests" href="/admin/requests" cta="Manage requests" rows={[["Open", summary.requests.open], ["Not yet assigned", summary.requests.unassigned]]} />}
      {summary.bookings && <SummaryCard title="Bookings" href="/admin/bookings" cta="Review bookings" rows={[["Upcoming and paid", summary.bookings.upcoming], ["Refunds to make", summary.bookings.refundDue]]} />}
      {summary.payouts && <SummaryCard title="Owner payouts" href="/admin/payouts" cta="Manage payouts" rows={[["Due for transfer", summary.payouts.dueCount], ["Total amount due", `LKR ${summary.payouts.dueAmount.toLocaleString("en-LK")}`]]} />}
      {summary.commissions && <SummaryCard title="Commissions & fees" href="/admin/commissions" cta="Manage commissions" rows={[["Invoices outstanding", summary.commissions.dueCount], ["Total amount due", `LKR ${summary.commissions.dueAmount.toLocaleString("en-LK")}`]]} />}
      {summary.complaints && <SummaryCard title="Complaints" href="/admin/complaints" cta="Review complaints" rows={[["Open", summary.complaints.open]]} />}
    </div>
  </>;

  return <section className="admin-dashboard">
    <div className="admin-heading"><div>
      <p className="eyebrow">RentalHub Sri Lanka / Administration</p>
      <h1>Platform overview</h1>
      <p>Review outstanding work and open the tools your permissions allow.</p>
    </div><span className="admin-account">Signed in as <strong>{user?.email ?? "Administrator"}</strong></span></div>
    {counts}
    {permissions.canManageAdmins && <AdminPermissionsForm />}
  </section>;
}
