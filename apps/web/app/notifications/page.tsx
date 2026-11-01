"use client";
import { useEffect, useState } from "react";
import { RequireSession } from "@/components/require-session";
import { apiRequest } from "@/lib/api-client";

type Notice = { id: string; title: string; message: string; createdAt: string; readAt: string | null };
type Filter = "all" | "unread";

function Inbox() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [marking, setMarking] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  useEffect(() => {
    void apiRequest<Notice[]>("/notifications", { authenticated: true }).then(setItems)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load notifications."))
      .finally(() => setLoading(false));
  }, []);
  async function read(id: string) {
    if (markingId) return;
    setMarkingId(id);
    setError("");
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PATCH", authenticated: true });
      setItems(current => current.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark notification as read.");
    } finally {
      setMarkingId(null);
    }
  }
  async function readAll() {
    if (marking) return;
    setMarking(true); setError("");
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH", authenticated: true });
      const now = new Date().toISOString();
      setItems(current => current.map(n => n.readAt ? n : { ...n, readAt: now }));
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to mark notifications as read."); }
    finally { setMarking(false); }
  }
  const unread = items.filter(n => !n.readAt).length;
  const shown = filter === "unread" ? items.filter(n => !n.readAt) : items;
  return <section className="notifications-page">
    <div className="page-heading"><div><p className="eyebrow">Your account</p>
      <h1>Notifications {unread > 0 && <span className="count-chip inline" role="status">{unread} unread</span>}</h1>
      <p className="intro">Updates on your search requests and property submissions.</p></div>
      <button type="button" className="secondary" disabled={marking || unread === 0} onClick={() => void readAll()}>✓ Mark all as read</button></div>
    <div className="segmented" role="group" aria-label="Filter notifications">
      {(["all", "unread"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All activity" : "Unread"}</button>)}
    </div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {loading ? <p role="status">Loading notifications…</p> : error && !items.length ? <button type="button" className="secondary" onClick={() => window.location.reload()}>Retry</button> : !shown.length ? <p className="notice">{filter === "unread" ? "You’re all caught up." : "No notifications yet."}</p> :
      <ul className="notice-list">{shown.map(n => <li key={n.id} className={n.readAt ? "is-read" : "is-unread"}>
        <span className="notice-dot" aria-hidden="true" />
        <div className="notice-body"><h2>{n.title}{!n.readAt && <span className="sr-only"> (unread)</span>}</h2><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}</small></div>
        {!n.readAt && <button type="button" className="ui-button ui-button-ghost" disabled={markingId !== null} aria-busy={markingId === n.id || undefined} onClick={() => void read(n.id)}>{markingId === n.id ? "Marking…" : "Mark as read"}</button>}
      </li>)}</ul>}
    <p className="small-copy notice-end">{items.length} {items.length === 1 ? "notification" : "notifications"} · End of recent activity</p>
  </section>;
}
export default function Page() { return <RequireSession><Inbox /></RequireSession>; }
