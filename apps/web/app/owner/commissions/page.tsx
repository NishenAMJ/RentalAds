"use client";
import { RequireSession } from "@/components/require-session";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/pagination";
import { Button, EmptyState, SkeletonCards } from "@/components/ui/primitives";

type CommissionStatus = "DUE" | "INVOICED" | "PAID" | "WAIVED";
type FeeType = "COMMISSION" | "LISTING_FEE";

interface OwnerCommission {
  id: string;
  feeType: FeeType;
  status: CommissionStatus;
  agreedRent: number | null;
  ratePercent: number | null;
  amount: number;
  note: string | null;
  paymentReference: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  listing: { id: string; areaText: string; address: string | null } | null;
}

const STATUS_LABEL: Record<CommissionStatus, string> = {
  DUE: "Due",
  INVOICED: "Invoiced",
  PAID: "Paid",
  WAIVED: "Waived",
};

const STATUS_CLASS: Record<CommissionStatus, string> = {
  DUE: "badge badge--warning",
  INVOICED: "badge badge--info",
  PAID: "badge badge--success",
  WAIVED: "badge badge--muted",
};

const FEE_LABEL: Record<FeeType, string> = {
  COMMISSION: "Commission (30% of agreed rent)",
  LISTING_FEE: "Ad posting fee",
};

function fmt(n: number) {
  return `LKR ${n.toLocaleString("en-LK")}`;
}

function CommissionRow({ c }: { c: OwnerCommission }) {
  return (
    <article className="panel commission-row">
      <div className="commission-row__header">
        <div>
          <span className={STATUS_CLASS[c.status]}>{STATUS_LABEL[c.status]}</span>
          <span className="small-copy muted">{FEE_LABEL[c.feeType]}</span>
        </div>
        <strong className="commission-row__amount">{fmt(c.amount)}</strong>
      </div>

      {c.listing && (
        <p className="commission-row__listing">
          <strong>Property:</strong> {c.listing.areaText}
          {c.listing.address ? ` — ${c.listing.address}` : ""}
        </p>
      )}

      <dl className="commission-row__details">
        {c.agreedRent != null && (
          <>
            <dt>Agreed monthly rent</dt>
            <dd>{fmt(c.agreedRent)}</dd>
          </>
        )}
        {c.ratePercent != null && (
          <>
            <dt>Commission rate</dt>
            <dd>{c.ratePercent}%</dd>
          </>
        )}
        {c.paymentReference && (
          <>
            <dt>Payment reference</dt>
            <dd>{c.paymentReference}</dd>
          </>
        )}
        {c.invoicedAt && (
          <>
            <dt>Invoiced</dt>
            <dd>{new Date(c.invoicedAt).toLocaleDateString("en-LK")}</dd>
          </>
        )}
        {c.paidAt && (
          <>
            <dt>Paid on</dt>
            <dd>{new Date(c.paidAt).toLocaleDateString("en-LK")}</dd>
          </>
        )}
      </dl>

      {c.note && <p className="commission-row__note">{c.note}</p>}

      <p className="small-copy muted">
        Recorded {new Date(c.createdAt).toLocaleDateString("en-LK")}
      </p>
    </article>
  );
}

function MyCommissions() {
  const pager = usePaginated<OwnerCommission>("/admin/commissions/mine", true);
  const { items, loading } = pager;

  const due = items.filter((c) => c.status === "DUE");
  const dueTotal = due.reduce((sum, c) => sum + c.amount, 0);

  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Your owner workspace</p>
          <h1>Commission &amp; fee obligations</h1>
          <p className="intro">
            RentalHub charges a commission of 30% of one month&rsquo;s agreed rent for each
            successful introduction. The team will contact you to arrange payment once a
            match is confirmed.
          </p>
        </div>
      </div>

      {!loading && due.length > 0 && (
        <section className="dashboard-summary" aria-label="Outstanding commissions">
          <div>
            <strong>{due.length}</strong>
            <span>Outstanding {due.length === 1 ? "invoice" : "invoices"}</span>
          </div>
          <div>
            <strong>{fmt(dueTotal)}</strong>
            <span>Total amount due</span>
          </div>
        </section>
      )}

      {pager.error && (
        <div className="notice error" role="alert">
          {pager.error}
          <Button variant="secondary" onClick={pager.retry}>Try again</Button>
        </div>
      )}

      <div className="section-heading compact">
        <h2>Your commissions &amp; fees</h2>
        <span className="muted small-copy">Page {pager.page} · Most recent first</span>
      </div>

      {loading ? (
        <SkeletonCards />
      ) : items.length === 0 ? (
        <EmptyState
          title="No commissions recorded yet."
          description="Once a match is confirmed and a commission is recorded by the RentalHub team, it will appear here."
          action={null}
        />
      ) : (
        <div className="owner-list">
          {items.map((c) => <CommissionRow key={c.id} c={c} />)}
        </div>
      )}

      <Pagination
        {...pager}
        loading={loading}
        onPageChange={(page) => pager.setPage(page)}
      />

      <div className="info-bar">
        <p className="small-copy muted">
          Commission is due after a successful rental introduction. Contact the RentalHub
          team if you have a question about an invoice or payment.
        </p>
      </div>
    </>
  );
}

export default function OwnerCommissionsPage() {
  return (
    <RequireSession>
      <MyCommissions />
    </RequireSession>
  );
}
