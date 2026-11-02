"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";

type Activity = { id: string; action: string; entityType: string; entityId: string; summary: string; createdAt: string; actor: { email: string } };
type Result = { data: Activity[]; page: number; limit: number; hasNextPage: boolean };

export default function AdminActivityPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    apiRequest<Result>(`/admin/activity?page=${page}&limit=25`, { authenticated: true, signal })
      .then(setResult)
      .catch(cause => { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load admin activity."); })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [page]);
  useEffect(() => { const controller = new AbortController(); setError(""); load(controller.signal); return () => controller.abort(); }, [load]);

  return <main className="page-shell">
    <header className="page-heading"><p className="eyebrow">Administration</p><h1>Activity history</h1><p>Recent actions taken by administrators across the platform.</p></header>
    {error && <p role="alert" className="form-error">{error}</p>}
    {loading && <p role="status">Loading activity…</p>}
    {!loading && result?.data.length === 0 && <section className="panel"><p>No admin actions have been recorded yet.</p></section>}
    {!!result?.data.length && <>
      <div className="table-wrap"><table><thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
        <tbody>{result.data.map(item => <tr key={item.id}>
          <td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.actor.email}</td><td>{item.action.replaceAll("_", " ").toLowerCase()}</td>
          <td>{item.entityType.toLowerCase()}<br /><code>{item.entityId}</code></td><td>{item.summary}</td>
        </tr>)}</tbody>
      </table></div>
      <nav aria-label="Activity pages" className="pagination">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
        <span>Page {page}</span>
        <button className="secondary" disabled={!result.hasNextPage} onClick={() => setPage(value => value + 1)}>Next</button>
      </nav>
    </>}
  </main>;
}
