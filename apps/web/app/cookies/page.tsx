import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookie notice | RentalHub Sri Lanka", description: "The few cookies and browser storage items RentalHub Sri Lanka uses." };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie notice" intro="The site does not use advertising or analytics tracking cookies. It stores a few preferences in your browser.">
      <h2>Browser storage</h2>
      <table className="legal-table">
        <thead><tr><th scope="col">Item</th><th scope="col">Purpose</th><th scope="col">Needed?</th></tr></thead>
        <tbody>
          <tr><td>Authentication session (held in memory by Supabase)</td><td>Allows account actions during the current page session; signing in again may be required after a reload</td><td>Needed for account features</td></tr>
          <tr><td><code>rentalhub-theme</code> (local storage)</td><td>Remembers light or dark mode</td><td>Convenience only</td></tr>
          <tr><td><code>rentalhub-lang</code> (local storage)</td><td>Remembers your language</td><td>Convenience only</td></tr>
        </tbody>
      </table>
      <h2>Third-party content</h2>
      <p>Maps load tiles from OpenStreetMap and photos load from our image host. These providers can see your IP address when your browser requests them.</p>
      <h2>Your choices</h2>
      <p>You can clear local storage in your browser settings at any time. Your theme and language preferences will reset. Sign-in state is held in memory and ends when the page session is cleared or the page is reloaded.</p>
    </LegalPage>
  );
}
