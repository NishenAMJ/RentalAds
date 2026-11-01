"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useT } from "@/components/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { todayInSriLanka } from "@/lib/items";

interface Block { id: string; startDate: string; endDate: string; note: string | null }

/** An item owner's own calendar: dates they have taken off so nobody can book them. */
export function BlockedDates({ listingId }: { listingId: string }) {
  const t = useT();
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [reloads, setReloads] = useState(0);
  const refresh = () => setReloads((count) => count + 1);

  useEffect(() => {
    let active = true;
    apiRequest<Block[]>(`/listings/${listingId}/blocks`, { authenticated: true })
      .then((result) => { if (active) setBlocks(result); })
      .catch((cause: unknown) => { if (active) { setBlocks([]); setError(cause instanceof Error ? cause.message : ""); } });
    return () => { active = false; };
  }, [listingId, reloads]);

  async function change(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await work(); refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : ""); }
    finally { setBusy(false); }
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await change(async () => {
      await apiRequest(`/listings/${listingId}/blocks`, { method: "POST", authenticated: true, body: JSON.stringify({ startDate: start, endDate: end, ...(note.trim() ? { note: note.trim() } : {}) }) });
      setStart(""); setEnd(""); setNote("");
    });
  }

  return <section className="panel" aria-labelledby="blocked-dates-title">
    <h2 id="blocked-dates-title" className="side-title">{t("owner.cal.title")}</h2>
    <p className="small-copy">{t("owner.cal.intro")}</p>
    <form className="form-grid two-columns" onSubmit={(event) => void add(event)}>
      <label>{t("rent.book.start")}<input type="date" min={todayInSriLanka()} value={start} onChange={(event) => setStart(event.target.value)} required disabled={busy} /></label>
      <label>{t("rent.book.end")}<input type="date" min={start || todayInSriLanka()} value={end} onChange={(event) => setEnd(event.target.value)} required disabled={busy} /></label>
      <label className="full-width">{t("owner.cal.note")}<input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} disabled={busy} /></label>
      <div className="full-width"><button className="ui-button ui-button-primary" disabled={busy}>{t("owner.cal.add")}</button></div>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}
    {blocks && !blocks.length && <p className="small-copy">{t("owner.cal.empty")}</p>}
    {blocks && blocks.length > 0 && <ul className="block-list">{blocks.map((block) =>
      <li key={block.id}><span>{block.startDate} → {block.endDate}{block.note ? ` · ${block.note}` : ""}</span>
        <button type="button" className="text-button" disabled={busy} onClick={() => void change(() => apiRequest(`/listings/${listingId}/blocks/${block.id}`, { method: "DELETE", authenticated: true }))}>{t("owner.cal.remove")}</button></li>)}</ul>}
  </section>;
}
