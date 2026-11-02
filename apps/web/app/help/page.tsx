import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Help and safety | RentalHub Sri Lanka",
  description: "How home introductions, item bookings, payments, cancellations and safety work on RentalHub Sri Lanka.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return <article className="legal-page">
    <header className="page-heading"><div><p className="eyebrow">Help and safety</p><h1>Know what to expect.</h1>
      <p className="intro">Homes and rentable items follow different processes. Here is how each one works and where to get help.</p></div></header>

    <div className="legal-body">
    <section><h2>Finding a home</h2>
      <p>Send a private request with your preferred areas, budget and home requirements. Our team reviews it and may contact you about a potential match. A request does not guarantee that a suitable home is available.</p>
      <p>Home listings are reviewed before publication. The team arranges introductions; renters and owners should inspect the property, confirm the terms and make their own tenancy agreement.</p>
    </section>

    <section><h2>Booking vehicles, equipment and event gear</h2>
      <p>Choose an item and dates to see the rental price, service fee and any refundable deposit before you pay. Dates are held for 30 minutes while you complete payment with PayHere. The owner’s phone number is shown after payment is confirmed.</p>
      <p>You can review the applicable cancellation refund before confirming a cancellation. Refunds are currently processed by the RentalHub team manually, so allow a few days after the team marks one as sent.</p>
    </section>

    <section><h2>Deposits and problems with a rental</h2>
      <p>For item rentals, the owner is responsible for returning the deposit after the rental unless there is a damage or missing-item issue. If there is a problem, contact us within 48 hours of the return and include your booking reference and any relevant details. The team will review both sides.</p>
      <p>For an urgent issue during a rental, use the contact details shared after the booking is paid. For payment, cancellation or deposit questions, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </section>

    <section><h2>For item owners</h2>
      <p>Owners submit each item for review before it appears. Renters pay the total shown at checkout through PayHere. Payouts are currently handled manually; contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for the current payout process before accepting bookings.</p>
    </section>

    <section><h2>What listing review means</h2>
      <p>Our team reviews submitted listings for suitability before they appear. We do not currently perform formal identity checks on owners, guarantee ownership or authority to rent, or independently certify an item’s condition. Review a home or item carefully and agree on handover and rental terms before proceeding.</p>
      <p>Report a listing from its page if information appears false, unsafe or inappropriate. Our team can review and remove content.</p>
    </section>

    <p className="small-copy">Read the full <a href="/terms">terms of service</a> and <a href="/privacy">privacy policy</a>.</p>
    </div>
  </article>;
}
