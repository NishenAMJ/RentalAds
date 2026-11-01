"use client";

import { useState, type FormEvent } from "react";

import { getAccessToken } from "@/lib/auth";
import { apiRequest } from "@/lib/api-client";

export function ReportListingButton({ listingId }: { listingId: string }) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const website = String(
      new FormData(event.currentTarget).get("website") ?? "",
    );
    setError("");
    if (reason.trim().length < 10) {
      setError("Please enter at least 10 characters.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const token = await getAccessToken();
      await apiRequest("/complaints", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          targetType: "LISTING",
          targetId: listingId,
          reason,
          website,
        }),
      });
      setStatus("done");
    } catch {
      setError("Unable to submit your report. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="notice" role="status">
        Thanks — we&apos;ll review this listing.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        type="button"
        className="text-button mt-2"
      >
        Report this listing
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="panel report-form">
      <div style={{ display: "none" }} aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor="report-reason">What should our team review?</label>
      <textarea
        id="report-reason"
        autoFocus
        minLength={10}
        maxLength={2000}
        required
        disabled={status === "submitting"}
        aria-invalid={status === "error"}
        aria-describedby={status === "error" ? "report-error" : undefined}
        className="w-full border rounded p-2 text-sm"
        rows={3}
        placeholder="What's wrong with this listing?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {status === "error" && (
        <p id="report-error" role="alert" className="field-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="bg-black text-white text-sm rounded px-3 py-1 mt-2 disabled:opacity-50"
      >
        {status === "submitting" ? "Sending..." : "Submit report"}
      </button>
      <button type="button" className="secondary" disabled={status === "submitting"} onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}
