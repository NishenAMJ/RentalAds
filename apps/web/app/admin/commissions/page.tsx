"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";

type Commission = {
  id: string;
  listingId: string;
  ownerId: string;
  matchId: string | null;
  feeType: "COMMISSION" | "LISTING_FEE";
  agreedRent: number | null;
  ratePercent: number | null;
  amount: number;
  status: "DUE" | "INVOICED" | "PAID" | "WAIVED";
  paymentReference: string | null;
  note: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  listing: {
    id: string;
    reference: string | null;
    title: string | null;
    areaText: string;
    propertyType: string | null;
    monthlyRent: number;
  };
  owner: {
    id: string;
    email: string;
    phone: string | null;
  };
};

type Page = {
  data: Commission[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
};

export default function AdminCommissionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [feeTypeFilter, setFeeTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string>("");

  // Edit modal / inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(30);
  const [editRent, setEditRent] = useState<number>(0);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>("");
  const [editRef, setEditRef] = useState<string>("");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createListingId, setCreateListingId] = useState("");
  const [createFeeType, setCreateFeeType] = useState<
    "COMMISSION" | "LISTING_FEE"
  >("COMMISSION");
  const [createRent, setCreateRent] = useState("");
  const [createRate, setCreateRate] = useState("30");
  const [createAmount, setCreateAmount] = useState("");
  const [createNote, setCreateNote] = useState("");

  const load = useCallback(
    (signal?: AbortSignal) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(feeTypeFilter ? { feeType: feeTypeFilter } : {}),
      });
      apiRequest<Page>(`/admin/commissions?${params}`, {
        authenticated: true,
        signal,
      })
        .then(setResult)
        .catch((cause: unknown) => {
          if (!signal?.aborted)
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to load commissions.",
            );
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [page, statusFilter, feeTypeFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function updateStatus(
    id: string,
    status: "INVOICED" | "PAID" | "WAIVED",
    paymentReference?: string,
  ) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/commissions/${id}`, {
        method: "PATCH",
        authenticated: true,
        body: JSON.stringify({ status, paymentReference }),
      });
      setMessage(`Commission marked as ${status.toLowerCase()}.`);
      load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update status.",
      );
    } finally {
      setBusy("");
    }
  }

  function startEdit(c: Commission) {
    setEditingId(c.id);
    setEditRate(c.ratePercent ?? 30);
    setEditRent(c.agreedRent ?? c.listing.monthlyRent);
    setEditAmount(c.amount);
    setEditNote(c.note ?? "");
    setEditRef(c.paymentReference ?? "");
  }

  async function saveEdit(id: string) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/commissions/${id}`, {
        method: "PATCH",
        authenticated: true,
        body: JSON.stringify({
          ratePercent: editRate,
          agreedRent: editRent,
          amount: editAmount,
          note: editNote,
          paymentReference: editRef,
        }),
      });
      setMessage("Commission updated successfully.");
      setEditingId(null);
      load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update commission.",
      );
    } finally {
      setBusy("");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError("");
    setMessage("");
    try {
      await apiRequest("/admin/commissions", {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({
          listingId: createListingId.trim(),
          feeType: createFeeType,
          agreedRent: createRent ? Number(createRent) : undefined,
          ratePercent: createRate ? Number(createRate) : undefined,
          amount: createAmount ? Number(createAmount) : undefined,
          note: createNote.trim() || undefined,
        }),
      });
      setMessage("Commission/fee record created.");
      setShowCreate(false);
      setCreateListingId("");
      setCreateRent("");
      setCreateAmount("");
      setCreateNote("");
      load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create commission record.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="admin-workspace">
      <header className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>Property commissions & listing fees</h1>
        <p className="intro">
          Manage success commissions (default 30% of first month’s agreed rent)
          and ad posting fees. Admins have full authority to adjust commission
          rates, enter agreed rent, or waive fees.
        </p>
      </header>

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}

      <section className="panel">
        <div
          className="filter-row"
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <label htmlFor="status-filter">Status: </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="DUE">Due</option>
              <option value="INVOICED">Invoiced</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>

          <div>
            <label htmlFor="feetype-filter">Fee type: </label>
            <select
              id="feetype-filter"
              value={feeTypeFilter}
              onChange={(e) => {
                setFeeTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All fee types</option>
              <option value="COMMISSION">
                Property commission (Introduction)
              </option>
              <option value="LISTING_FEE">Ad posting fee</option>
            </select>
          </div>

          <button
            type="button"
            className="secondary"
            onClick={() => setShowCreate(!showCreate)}
            style={{ marginLeft: "auto" }}
          >
            {showCreate ? "Close form" : "+ Record commission or ad fee"}
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={handleCreate}
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              border: "1px solid var(--border, #ccc)",
              borderRadius: "8px",
            }}
          >
            <h3>Record a commission or ad fee</h3>
            <div
              className="field-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <label>
                Listing ID (UUID) *
                <input
                  type="text"
                  required
                  value={createListingId}
                  onChange={(e) => setCreateListingId(e.target.value)}
                  placeholder="Listing UUID"
                />
              </label>

              <label>
                Fee Type
                <select
                  value={createFeeType}
                  onChange={(e) =>
                    setCreateFeeType(
                      e.target.value as "COMMISSION" | "LISTING_FEE",
                    )
                  }
                >
                  <option value="COMMISSION">
                    Property Commission (Introduction)
                  </option>
                  <option value="LISTING_FEE">Ad Posting Fee</option>
                </select>
              </label>

              {createFeeType === "COMMISSION" && (
                <>
                  <label>
                    Agreed monthly rent (LKR)
                    <input
                      type="number"
                      min={1}
                      value={createRent}
                      onChange={(e) => {
                        setCreateRent(e.target.value);
                        if (e.target.value && createRate) {
                          setCreateAmount(
                            String(
                              Math.round(
                                (Number(e.target.value) * Number(createRate)) /
                                  100,
                              ),
                            ),
                          );
                        }
                      }}
                      placeholder="e.g. 100000"
                    />
                  </label>

                  <label>
                    Commission rate %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={createRate}
                      onChange={(e) => {
                        setCreateRate(e.target.value);
                        if (createRent && e.target.value) {
                          setCreateAmount(
                            String(
                              Math.round(
                                (Number(createRent) * Number(e.target.value)) /
                                  100,
                              ),
                            ),
                          );
                        }
                      }}
                    />
                  </label>
                </>
              )}

              <label>
                Total Amount (LKR) *
                <input
                  type="number"
                  min={0}
                  required
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  placeholder="Calculated or custom"
                />
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Admin note
                <input
                  type="text"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder="e.g. Rental concluded for 1-year lease; agreed rate 30%"
                />
              </label>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={busy === "create"}
                className="ui-button ui-button-primary"
              >
                {busy === "create" ? "Saving…" : "Save record"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {loading && <p role="status">Loading commissions…</p>}

      {!loading && result?.data.length === 0 && (
        <section className="panel">
          <p>No property commissions or fees match the selected filter.</p>
        </section>
      )}

      {!!result?.data.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Property / fee</th>
                <th scope="col">Owner</th>
                <th scope="col">Status / amount</th>
                <th scope="col">Terms / payment</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.listing.title ?? c.listing.areaText}</strong>
                    <br />
                    {c.listing.areaText}
                    <br />
                    {c.listing.reference}
                    <br />
                    <span className="ui-badge">
                      {c.feeType === "COMMISSION"
                        ? "Introduction commission"
                        : "Ad posting fee"}
                    </span>
                  </td>
                  <td>{c.owner.email}</td>
                  <td>
                    <span
                      className={`ui-badge ${c.status === "PAID" ? "badge-success" : c.status === "WAIVED" ? "" : "badge-warning"}`}
                    >
                      {c.status.toLowerCase()}
                    </span>
                    <br />
                    <strong>LKR {c.amount.toLocaleString("en-LK")}</strong>
                  </td>
                  <td>
                    {c.feeType === "COMMISSION" && (
                      <>
                        Rent: LKR{" "}
                        {(c.agreedRent ?? c.listing.monthlyRent).toLocaleString(
                          "en-LK",
                        )}{" "}
                        @ {c.ratePercent ?? 30}%<br />
                      </>
                    )}
                    {c.paymentReference && (
                      <>
                        Payment ref: <code>{c.paymentReference}</code>
                        <br />
                      </>
                    )}
                    {c.paidAt && (
                      <>
                        Paid{" "}
                        {new Date(c.paidAt).toLocaleDateString("en-GB", {
                          timeZone: "Asia/Colombo",
                        })}
                        <br />
                      </>
                    )}
                    {c.note && <small>{c.note}</small>}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <div className="stack">
                        <label>
                          Agreed rent
                          <input
                            type="number"
                            min={1}
                            value={editRent}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setEditRent(value);
                              setEditAmount(
                                Math.round((value * editRate) / 100),
                              );
                            }}
                          />
                        </label>
                        <label>
                          Rate %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editRate}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setEditRate(value);
                              setEditAmount(
                                Math.round((editRent * value) / 100),
                              );
                            }}
                          />
                        </label>
                        <label>
                          Amount override
                          <input
                            type="number"
                            min={0}
                            value={editAmount}
                            onChange={(e) =>
                              setEditAmount(Number(e.target.value))
                            }
                          />
                        </label>
                        <label>
                          Payment reference
                          <input
                            value={editRef}
                            onChange={(e) => setEditRef(e.target.value)}
                          />
                        </label>
                        <label>
                          Admin note
                          <input
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => saveEdit(c.id)}
                          disabled={busy === c.id}
                        >
                          Save changes
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="table-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => startEdit(c)}
                          disabled={busy === c.id}
                        >
                          Adjust terms
                        </button>
                        {c.status === "DUE" && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => updateStatus(c.id, "INVOICED")}
                            disabled={busy === c.id}
                          >
                            Mark invoiced
                          </button>
                        )}
                        {c.status !== "PAID" && (
                          <button
                            type="button"
                            onClick={() => {
                              const ref = window.prompt(
                                "Enter payment transfer reference / bank receipt #:",
                              );
                              if (ref !== null) updateStatus(c.id, "PAID", ref);
                            }}
                            disabled={busy === c.id}
                          >
                            Record payment
                          </button>
                        )}
                        {c.status !== "WAIVED" && c.status !== "PAID" && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Are you sure you want to waive this fee?",
                                )
                              )
                                updateStatus(c.id, "WAIVED");
                            }}
                            disabled={busy === c.id}
                          >
                            Waive
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!result?.data.length && (
        <nav
          aria-label="Commission pages"
          className="pagination"
          style={{ marginTop: "1rem" }}
        >
          <button
            className="secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil((result.total || 1) / result.limit)}
          </span>
          <button
            className="secondary"
            disabled={!result.hasNextPage || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
