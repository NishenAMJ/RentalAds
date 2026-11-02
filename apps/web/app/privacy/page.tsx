import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy | RentalHub Sri Lanka", description: "What personal information RentalHub Sri Lanka collects, why, who sees it and how you can control it." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" intro="We use your information to run home introductions and item bookings, protect accounts, and provide support.">
      <h2>Who we are</h2>
      <p>{OPERATOR_NAME} runs this service in Sri Lanka and is the controller of the personal data described here. Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address and a password handled by our sign-in provider.</li>
        <li><strong>Home requests:</strong> preferred areas, an optional map search area, budget, stay length, home preferences and the phone number you give us.</li>
        <li><strong>Listings:</strong> home or item details, price and terms, photos, location information and the owner contact number.</li>
        <li><strong>Item bookings:</strong> selected dates, booking and cancellation records, the renter contact number, and payment status and references from PayHere. Card details are handled by PayHere, not stored by RentalHub.</li>
        <li><strong>Reports and activity:</strong> complaints you submit, notifications we send you, and records of admin actions such as approvals and removals.</li>
        <li><strong>Technical data:</strong> your IP address and request logs, used for security and to limit abuse.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To review listings and home requests, arrange home introductions, and create and administer item bookings and payments.</li>
        <li>To keep the service safe, investigate reports and prevent abuse.</li>
        <li>To contact you about requests, listings, bookings, payments, refunds and support.</li>
      </ul>

      <h2>Who can see it</h2>
      <p>Owner and renter phone numbers are <strong>not shown on public listings</strong>. For homes, authorised administrators coordinate introductions. For item rentals, the renter and owner receive each other’s contact numbers after payment is confirmed. Public listings show listing details, photos and an approximate location.</p>
      <p>We use service providers to run the site, including Supabase (sign-in and database hosting), Cloudinary (photo storage), PayHere (item payments), Resend (email when configured), and our web and API hosting providers. They process data to provide their services. We do not sell personal data.</p>
      <p>Before you share photos, remove anything that identifies an address or a person. We remove embedded location metadata from uploaded photos.</p>

      <h2>How long we keep it</h2>
      <p>We keep your data while your account is active. Requests and properties you delete are hidden from everyone but administrators. When you delete your account, we remove your personal details and your requests, and anonymise records we must keep for safety and dispute handling.</p>

      <h2>Your rights</h2>
      <p>You can see, correct, export and delete your information. Use the <Link href="/account">account page</Link> to download your data or delete your account, or email us. You may also complain to the Data Protection Authority of Sri Lanka.</p>

      <h2>Security</h2>
      <p>Connections are encrypted, access to administrator tools is limited by permission, and uploads are checked before they are stored. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters to you, we will update the date above and tell you in the app.</p>
    </LegalPage>
  );
}
