import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of service | RentalHub Sri Lanka", description: "The rules for using RentalHub Sri Lanka as a renter or property owner." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" intro="Plain rules for using RentalHub Sri Lanka as a renter or a property owner.">
      <h2>What the service is</h2>
      <p>{OPERATOR_NAME} offers two rental flows in Sri Lanka. For homes, our team reviews requests and listing submissions and helps arrange introductions; we do not collect home rent or guarantee a match. For vehicles, equipment and event gear, renters can book dates and pay through our payment partner. In both flows, the owner provides the rental and remains responsible for the accuracy and condition of the listing.</p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your password secure.</li>
        <li>You are responsible for activity on your account.</li>
        <li>You must be at least 18 years old.</li>
      </ul>

      <h2>Property owners</h2>
      <ul>
        <li>You confirm you own the property or are authorised to let it.</li>
        <li>Rent, terms, photos and availability must be accurate and kept up to date. Confirm availability regularly. Listings that are not confirmed may be hidden.</li>
        <li>Only upload photos you have the right to use. Do not include contact details or other people in them.</li>
        <li>We may approve, reject, hide or remove any listing, with a reason where we can give one.</li>
      </ul>

      <h2>Renters</h2>
      <ul>
        <li>Requests should reflect what you genuinely want to rent.</li>
        <li>Check the property, the owner and the agreement yourself before paying anyone. Never send money before you have met the owner and seen the property.</li>
      </ul>

      <h2>Renting items: vehicles, equipment and event gear</h2>
      <p>Items are booked by date and paid for through our payment partner, PayHere. This is different from homes, where our team introduces you personally. For items the owner and renter agree the rental when the booking is paid, and {OPERATOR_NAME} is not the owner or the renter.</p>
      <ul>
        <li><strong>What you pay:</strong> the rental, a service fee shown before you pay, and a refundable deposit if the owner asks for one. The total is shown before you confirm.</li>
        <li><strong>Holding your dates:</strong> dates are held for 30 minutes while you pay. If you do not pay in that time they are released.</li>
        <li><strong>Contact details:</strong> the owner&rsquo;s and the renter&rsquo;s phone numbers are shared with each other only after the booking is paid.</li>
        <li><strong>If you cancel:</strong> cancel at least 7 days before the start for a full refund. Cancel 2 to 6 days before and you get your deposit and half of the rental back; the service fee is not refunded. Cancel later than that and only your deposit is returned. A rental that has started cannot be cancelled online.</li>
        <li><strong>If the owner cancels, or we cannot confirm your booking:</strong> you are refunded in full.</li>
        <li><strong>Refunds:</strong> we send refunds by hand to the card or account you paid with and email you when it is sent. It can take a few days to show.</li>
        <li><strong>Deposits:</strong> the deposit is returned after the rental unless the owner reports damage or missing items. Tell us within 48 hours of the return and we will look at both sides.</li>
        <li><strong>Owners:</strong> you may block dates you cannot offer. Cancelling a paid booking refunds the renter in full, so please do it only when you really cannot provide the item. Repeated cancellations can lead to your listing being removed.</li>
      </ul>

      <h2>Not allowed</h2>
      <ul>
        <li>False, misleading or duplicate listings, or fake requests.</li>
        <li>Harassing others, or collecting or sharing contact details outside the introduction process.</li>
        <li>Scraping the service, or trying to access accounts, data or admin tools you are not permitted to use.</li>
      </ul>

      <h2>Reports and removal</h2>
      <p>You can report a listing from its page. We may remove content or suspend accounts that break these terms, or to protect users.</p>

      <h2>Liability</h2>
      <p>The service is provided as is. To the extent the law allows, we are not liable for losses from agreements made between renters and owners, or for information supplied by users. Nothing here limits rights that cannot be limited by law.</p>

      <h2>Changes and governing law</h2>
      <p>We may update these terms and will update the date above. Continued use means you accept the changes. These terms are governed by the laws of Sri Lanka.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  );
}
