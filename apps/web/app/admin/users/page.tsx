"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api-client";

type Account = {
  id: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "RENTER" | "ADMIN";
  accountStatus: "ACTIVE" | "SUSPENDED";
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  adminPermission: { canApproveListings: boolean; canManageAdmins: boolean; canManageComplaints: boolean; canManagePayouts: boolean; canManageCommissions: boolean } | null;
};
type Page = { data: Account[]; page: number; limit: number; hasNextPage: boolean };

export default function AdminUsersPage() {
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback((signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (status) params.set("status", status);
    if (role) params.set("role", role);
    if (query) params.set("search", query);
    apiRequest<Page>(`/admin/users?${params}`, { authenticated: true, signal })
      .then(data => { setResult(data); setError(""); })
      .catch(cause => { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load accounts."); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [page, query, role, status]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(search.trim());
  }

  function changeFilter(kind: "status" | "role", value: string) {
    setLoading(true);
    if (kind === "status") setStatus(value);
    else setRole(value);
    setPage(1);
  }

  async function changeStatus() {
    if (!selected) return;
    const account = selected;
    const next = account.accountStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const trimmedReason = reason.trim();
    if (!trimmedReason) { setError("Enter a reason before changing an account status."); return; }
    setBusyId(account.id); setError(""); setMessage("");
    try {
      await apiRequest(`/admin/users/${account.id}/status`, {
        method: "PATCH", authenticated: true,
        body: JSON.stringify({ status: next, reason: trimmedReason }),
      });
      setResult(current => current ? {
        ...current,
        data: current.data.map(user => user.id === account.id ? {
          ...user,
          accountStatus: next,
          suspendedAt: next === "SUSPENDED" ? new Date().toISOString() : null,
          suspensionReason: next === "SUSPENDED" ? trimmedReason : null,
        } : user),
      } : current);
      setMessage(`${account.email} was ${next === "SUSPENDED" ? "suspended" : "restored"}.`);
      setSelected(null);
      setReason("");
      setLoading(true);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this account.");
    } finally { setBusyId(""); }
  }

  const isAdmin = (account: Account) => account.role === "ADMIN" || (!!account.adminPermission && Object.values(account.adminPermission).some(Boolean));
  const visibleAccounts = result?.data ?? [];
  const visibleSuspended = visibleAccounts.filter(account => account.accountStatus === "SUSPENDED").length;
  const visibleAdmins = visibleAccounts.filter(isAdmin).length;

  return <main className="admin-workspace">
    <header className="page-heading user-page-heading"><span className="user-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span><div><p className="eyebrow">Administration / Access control</p><h1>User management</h1>
      <p className="intro">Find accounts by email or phone, narrow by role or status, and suspend or restore access. Active administrator accounts must have their permissions removed before suspension.</p></div></header>
    <section className="user-summary-grid" aria-label="Current page summary">
      <article className="user-summary-card"><span>Accounts shown</span><strong>{result?.data.length ?? "—"}</strong><small>Page {page}, up to 25 per page</small></article>
      <article className="user-summary-card"><span>Active</span><strong>{visibleAccounts.length - visibleSuspended}</strong><small>On this page</small></article>
      <article className="user-summary-card"><span>Suspended</span><strong>{visibleSuspended}</strong><small>On this page</small></article>
      <article className="user-summary-card"><span>Admin access</span><strong>{visibleAdmins}</strong><small>On this page</small></article>
    </section>
    <form className="panel user-filter-panel" onSubmit={searchUsers}>
      <div className="user-filter-grid">
        <label htmlFor="user-search">Email or phone<input id="user-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search accounts" /></label>
        <label htmlFor="user-status">Account status<select id="user-status" value={status} onChange={event => changeFilter("status", event.target.value)}><option value="">All accounts</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label>
        <label htmlFor="user-role">Account role<select id="user-role" value={role} onChange={event => changeFilter("role", event.target.value)}><option value="">All roles</option><option value="RENTER">Renter</option><option value="OWNER">Owner</option><option value="ADMIN">Administrator</option></select></label>
      </div>
      <div className="user-filter-actions"><button type="submit">Search accounts</button>
        {(query || search || status || role) && <button type="button" className="secondary" onClick={() => { setLoading(true); setSearch(""); setQuery(""); setStatus(""); setRole(""); setPage(1); }}>Clear filters</button>}
      </div>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {!loading && result && <p aria-live="polite">Showing {result.data.length} account{result.data.length === 1 ? "" : "s"}{query ? ` matching “${query}”` : ""}{result.hasNextPage ? " · more results available" : ""}.</p>}
    {loading && <p role="status">Loading accounts…</p>}
    {!loading && result?.data.length === 0 && <section className="panel"><p>No accounts match these filters.</p></section>}
    {!!result?.data.length && <div className="table-wrap">
      <table>
        <thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Moderation details</th><th scope="col">Action</th></tr></thead>
        <tbody>{result.data.map(account => {
          const admin = isAdmin(account);
          return <tr key={account.id}>
            <td><div className="user-account-cell"><span className="user-avatar" aria-hidden="true">{account.email.charAt(0).toUpperCase()}</span><span><strong>{account.email}</strong><small>{account.phone || "No phone listed"}</small></span></div></td>
            <td><span className="user-role-badge">{account.role.toLowerCase()}</span>{admin && <small className="user-admin-hint">Admin permissions</small>}</td>
            <td><span className={`user-status-pill ${account.accountStatus === "ACTIVE" ? "is-active" : "is-suspended"}`}><span />{account.accountStatus.toLowerCase()}</span></td>
            <td style={{ whiteSpace: "nowrap" }}>{new Date(account.createdAt).toLocaleDateString()}</td>
            <td style={{ maxWidth: 280 }}>{account.accountStatus === "SUSPENDED" ? <span title={account.suspensionReason ?? ""}><strong>Reason</strong><br />{account.suspensionReason || "No reason recorded"}<small className="user-admin-hint">{account.suspendedAt ? `Since ${new Date(account.suspendedAt).toLocaleDateString()}` : "Suspended"}</small></span> : admin ? <span className="user-admin-warning">Remove admin permissions before suspension</span> : <span className="muted">No moderation notes</span>}</td>
            <td style={{ whiteSpace: "nowrap" }}><button type="button" className={account.accountStatus === "ACTIVE" ? "danger-button" : "ui-button ui-button-primary"}
              disabled={account.accountStatus === "ACTIVE" && admin} onClick={() => { setSelected(account); setReason(""); setError(""); }}>
              {account.accountStatus === "ACTIVE" ? "Suspend" : "Restore"}
            </button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    {!!result?.data.length && <nav aria-label="User pages" className="pagination">
      <button className="secondary" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(value => Math.max(1, value - 1)); }}>Previous</button>
      <span>Page {page}</span>
      <button className="secondary" disabled={!result.hasNextPage || loading} onClick={() => { setLoading(true); setPage(value => value + 1); }}>Next</button>
    </nav>}
    {selected && <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setSelected(null); }} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.72)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="moderation-title" className="panel" style={{ width: "min(100%, 560px)" }}>
        <h2 id="moderation-title">{selected.accountStatus === "ACTIVE" ? "Suspend account" : "Restore account access"}</h2>
        <p>{selected.email}</p>
        <label htmlFor="moderation-reason">{selected.accountStatus === "ACTIVE" ? "Suspension message" : "Restoration reason"}</label>
        <textarea id="moderation-reason" rows={4} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={!!busyId} autoFocus placeholder="Explain why this account’s access is changing…" />
        <p>{reason.length}/1000 characters. This reason is recorded for administrators.</p>
        <div className="wizard-actions">
          <button type="button" className="secondary" disabled={!!busyId} onClick={() => setSelected(null)}>Cancel</button>
          <button type="button" className={selected.accountStatus === "ACTIVE" ? "danger-button" : "ui-button ui-button-primary"} disabled={!!busyId || !reason.trim()} onClick={() => void changeStatus()}>
            {busyId ? "Saving…" : selected.accountStatus === "ACTIVE" ? "Confirm suspension" : "Confirm restoration"}
          </button>
        </div>
      </section>
    </div>}
  </main>;
}
