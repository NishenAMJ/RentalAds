"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { RequireSession } from "@/components/require-session";

type Verification = {
  ownerVerificationStatus: "NOT_REQUESTED" | "REQUESTED" | "VERIFIED" | "REJECTED";
  ownerVerificationRequestedAt: string | null;
  ownerVerificationReviewedAt: string | null;
  ownerVerificationNote: string | null;
};

function OwnerVerification() {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiRequest<Verification & { authUserId: string }>("/users/me", { authenticated: true })
      .then(setVerification)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load verification status."));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function request() {
    setBusy(true);
    setError("");
    try {
      const updated = await apiRequest<Verification>("/users/me/verification", { method: "POST", authenticated: true });
      setVerification(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request verification.");
    } finally { setBusy(false); }
  }

  const status = verification?.ownerVerificationStatus;
  return <main className="admin-workspace">
    <header className="page-heading"><p className="eyebrow">Owner account</p><h1>Owner identity & authority check</h1>
      <p className="intro">Request a manual identity and rental authority check by RentalHub staff before introducing renters.</p></header>
    <section className="panel">
      <h2>Your status: {status === "VERIFIED" ? "Identity and authority confirmed" : status ? status.replaceAll("_", " ").toLowerCase() : "Loading…"}</h2>
      <p>Our team confirms identity and authority to rent outside this website. Do not upload identity documents or sensitive numbers here; we do not collect or store identity documents through this application.</p>
      {verification?.ownerVerificationNote && <p>Team note: {verification.ownerVerificationNote}</p>}
      {error && <p role="alert" className="notice error">{error}</p>}
      {status !== "REQUESTED" && status !== "VERIFIED" && <button className="ui-button ui-button-primary" type="button" disabled={busy || !verification} onClick={() => void request()}>
        {busy ? "Sending request…" : status === "REJECTED" ? "Request another review" : "Request identity & authority check"}
      </button>}
    </section>
  </main>;
}

export default function OwnerVerificationPage() {
  return <RequireSession><OwnerVerification /></RequireSession>;
}
