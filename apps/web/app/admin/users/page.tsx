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
  adminPermission: { canApproveListings: boolean; canManageAdmins: boolean; canManageComplaints: boolean; canManagePayouts: boolean } | null;
};
type Page = { data: Account[]; page: number; limit: number; hasNextPage: boolean };

export default function AdminUsersPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback((signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (status) params.set("status", status);
    if (query) params.set("search", query);
    setLoading(true);
    apiRequest<Page>(`/admin/users?${params}`, { authenticated: true, signal })
      .then(setResult)
      .catch(cause => { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load accounts."); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [page, query, status]);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function changeStatus(account: Account) {
    const next = account.accountStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const reason = reasons[account.id]?.trim();
    if (!reason) { setError("Enter a reason before changing an account status."); return; }
    setBusyId(account.id); setError(""); setMessage("");
    try {
      await apiRequest(`/admin/users/${account.id}/status`, {
        method: "PATCH", authenticated: true,
        body: JSON.stringify({ status: next, reason }),
      });
      setMessage(`${account.email} was ${next === "SUSPENDED" ? "suspended" : "restored"}.`);
      setReasons(current => ({ ...current, [account.id]: "" }));
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this account.");
    } finally { setBusyId(""); }
  }

  return <main className="admin-workspace">
    <header className="page-heading"><p className="eyebrow">Administration</p><h1>User moderation</h1>
      <p className="intro">Find accounts, review their role, and suspend or restore access. Active administrator accounts must have their permissions removed before suspension.</p></header>
    <form className="panel actions" onSubmit={searchUsers}>
      <label htmlFor="user-search">Email or phone</label>
      <input id="user-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search accounts" />
      <label htmlFor="user-status">Account status</label>
      <select id="user-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="">All accounts</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
      </select>
      <button type="submit">Search</button>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {loading && <p role="status">Loading accounts…</p>}
    {!loading && result?.data.length === 0 && <section className="panel"><p>No accounts match these filters.</p></section>}
    {!!result?.data.length && <div className="stack">{result.data.map(account => {
      const isAdmin = !!account.adminPermission && Object.values(account.adminPermission).some(Boolean);
      const isBusy = busyId === account.id;
      return <article className="panel" key={account.id}>
        <div className="record-heading"><h2>{account.email}</h2><span className={`ui-badge ${account.accountStatus === "ACTIVE" ? "badge-success" : "badge-warning"}`}>{account.accountStatus.toLowerCase()}</span></div>
        <p>Role: {account.role.toLowerCase()} · Joined {new Date(account.createdAt).toLocaleDateString()}{account.phone ? ` · ${account.phone}` : ""}</p>
        {isAdmin && <p>This account has administrator permissions. Remove those permissions before suspending it.</p>}
        {account.accountStatus === "SUSPENDED" && <p>Suspended {account.suspendedAt ? new Date(account.suspendedAt).toLocaleString() : ""}: {account.suspensionReason}</p>}
        <label htmlFor={`reason-${account.id}`}>{account.accountStatus === "ACTIVE" ? "Suspension reason" : "Restoration reason"}</label>
        <textarea id={`reason-${account.id}`} rows={2} maxLength={1000} value={reasons[account.id] ?? ""}
          onChange={event => setReasons(current => ({ ...current, [account.id]: event.target.value }))} disabled={isBusy || (account.accountStatus === "ACTIVE" && isAdmin)} />
        <button type="button" className={account.accountStatus === "ACTIVE" ? "danger-button" : "ui-button ui-button-primary"}
          disabled={isBusy || (account.accountStatus === "ACTIVE" && isAdmin)} onClick={() => void changeStatus(account)}>
          {isBusy ? "Saving…" : account.accountStatus === "ACTIVE" ? "Suspend account" : "Restore account access"}
        </button>
      </article>;
    })}</div>}
    {!!result?.data.length && <nav aria-label="User pages" className="pagination">
      <button className="secondary" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
      <span>Page {page}</span>
      <button className="secondary" disabled={!result.hasNextPage || loading} onClick={() => setPage(value => value + 1)}>Next</button>
    </nav>}
  </main>;
}
