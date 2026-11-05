"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";

type Account = {
  id: string;
  email: string;
  createdAt: string;
  ownerVerificationStatus: "REQUESTED";
  ownerVerificationRequestedAt: string | null;
};
type Page = { data: Account[]; page: number; limit: number; hasNextPage: boolean };

export default function AdminVerificationsPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback((signal?: AbortSignal) => {
    apiRequest<Page>(`/admin/users?verificationStatus=REQUESTED&page=${page}&limit=25`, { authenticated: true, signal })
      .then(setResult)
      .catch((cause: unknown) => { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load requests."); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function decide(account: Account, status: "VERIFIED" | "REJECTED") {
    const note = notes[account.id]?.trim();
    if (!note) { setError("Add a note explaining the verification decision."); return; }
    setBusy(account.id); setError(""); setMessage("");
    try {
      await apiRequest(`/admin/users/${account.id}/verification`, {
        method: "PATCH", authenticated: true,
        body: JSON.stringify({ status, note }),
      });
      setMessage(`Verification ${status.toLowerCase()} for ${account.email}.`);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update verification.");
    } finally { setBusy(""); }
  }

  return <main className="admin-workspace">
    <header className="page-heading"><p className="eyebrow">Administration</p><h1>Owner identity & authority checks</h1>
      <p className="intro">Record the outcome of a manual identity and rental authority check completed outside this website (e.g. title deeds, proof of residence, power of attorney). Never request or attach identity documents here.</p></header>
    {error && <p role="alert" className="notice error">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {loading && <p role="status">Loading requests…</p>}
    {!loading && result?.data.length === 0 && <section className="panel"><p>No pending identity & authority check requests.</p></section>}
    {!!result?.data.length && <div className="stack">{result.data.map(account => <article className="panel" key={account.id}>
      <h2>{account.email}</h2>
      <p>Requested {account.ownerVerificationRequestedAt ? new Date(account.ownerVerificationRequestedAt).toLocaleString() : "date unavailable"}.</p>
      <label htmlFor={`note-${account.id}`}>Decision note (e.g. checked deed, utility bill, authority basis)</label>
      <textarea id={`note-${account.id}`} rows={3} maxLength={1000} value={notes[account.id] ?? ""}
        onChange={event => setNotes(current => ({ ...current, [account.id]: event.target.value }))} disabled={busy === account.id} />
      <div className="wizard-actions">
        <button type="button" className="secondary" disabled={busy === account.id} onClick={() => void decide(account, "REJECTED")}>Decline check</button>
        <button type="button" className="ui-button ui-button-primary" disabled={busy === account.id} onClick={() => void decide(account, "VERIFIED")}>Confirm identity & authority</button>
      </div>
    </article>)}</div>}
    {!!result?.data.length && <nav aria-label="Verification request pages" className="pagination">
      <button className="secondary" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
      <span>Page {page}</span>
      <button className="secondary" disabled={!result.hasNextPage || loading} onClick={() => setPage(value => value + 1)}>Next</button>
    </nav>}
  </main>;
}
