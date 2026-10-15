import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of service | Sewana Lanka", description: "The rules for using Sewana Lanka as a renter or property owner." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" intro="Plain rules for using Sewana Lanka as a renter or a property owner.">
      <h2>What the service is</h2>
      <p>{OPERATOR_NAME} helps renters and property owners in Sri Lanka find each other. Our team reviews submissions and arranges introductions personally. We are an introduction service. We are not a party to any tenancy agreement, we do not collect rent or deposits, and we do not guarantee that a request will be matched or that a property is suitable or available.</p>

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
