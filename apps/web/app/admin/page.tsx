"use client";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { usePaginated } from "@/lib/use-paginated";
import { AdminMatches } from "@/components/admin-matches";
import { AdminPermissionsForm } from "@/components/admin-permissions-form";

type Entry = { id: string; areaText?: string; reason?: string; status: string };
function QueueCard({ path, href, title, description, empty }: {
  path: string; href: string; title: string; description: string; empty: string;
}) {
  const queue = usePaginated<Entry>(path, true);
  return <article className="panel admin-queue">
    <div className="admin-card-heading"><h2>{title}</h2>
      <button className="text-button" onClick={queue.retry} disabled={queue.loading}
        aria-label={`Refresh ${title.toLowerCase()}`}>Refresh</button></div>
    <p className="admin-description">{description}</p>
    {queue.loading ? <p role="status">Loading latest entries...</p> : queue.error ? (
      <p role="alert" className="notice error">{queue.error}</p>
    ) : <>
      <p className="admin-queue-count">{queue.items.length}{queue.hasNextPage ? "+" : ""}
        <span>{queue.hasNextPage ? "entries · latest 20 loaded" : "entries"}</span></p>
      {queue.items.length ? <ul className="admin-preview">
        {queue.items.slice(0, 3).map(item => <li key={item.id}>
          <span>{item.areaText || item.reason || "Review entry"}</span>
          <span className="admin-status">{item.status.replaceAll("_", " ").toLowerCase()}</span>
        </li>)}
      </ul> : <p className="notice">{empty}</p>}
    </>}
    <Link className="button" href={href}>Open {title.toLowerCase()} →</Link>
  </article>;
}
export default function AdminDashboard() {
  const { permissions, user } = useAuth();
  return <section className="admin-dashboard">
    <div className="admin-heading"><div>
      <p className="eyebrow">RentalHub Sri Lanka / Administration</p>
      <h1>Your platform at a glance.</h1>
      <p>Review properties, connect renters with homes, and keep reports moving.</p>
    </div><span className="admin-account">Signed in as <strong>{user?.email ?? "Administrator"}</strong></span></div>
    {permissions.canApproveListings && <AdminMatches />}
    <div className="admin-section-heading"><h2>Your work queues</h2><p>Latest entries from the areas you manage.</p></div>
    <div className="admin-queues">
      {permissions.canApproveListings && <>
        <QueueCard path="/listings/pending" href="/admin/listings" title="Pending listings"
          description="Check property details and photos before approving publication."
          empty="All caught up. No properties are waiting for review." />
        <QueueCard path="/requests" href="/admin/requests" title="Rental requests"
          description="Review renter requirements, find suggestions, and track introductions."
          empty="No rental requests have been submitted yet." />
      </>}
      {permissions.canManageComplaints && <QueueCard path="/complaints" href="/admin/complaints" title="Complaints"
        description="Review submitted reports, update their status, and record your findings."
        empty="No complaints have been submitted." />}
    </div>
    {permissions.canManageAdmins && <AdminPermissionsForm />}
    <aside className="panel admin-access-summary"><h2>Your access</h2>
      <p>Available tools follow the permissions assigned to your account.</p><ul>
        {permissions.canApproveListings && <li>Listing approvals and rental matching</li>}
        {permissions.canManageComplaints && <li>Complaint review and resolution</li>}
        {permissions.canManageAdmins && <li>Admin access management</li>}
      </ul></aside>
  </section>;
}
