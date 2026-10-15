import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Cookie notice | Sewana Lanka", description: "The few cookies and browser storage items Sewana Lanka uses." };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie notice" intro="We use only what the site needs to work. There is no advertising or tracking.">
      <h2>What we store in your browser</h2>
      <table className="legal-table">
        <thead><tr><th scope="col">Item</th><th scope="col">Purpose</th><th scope="col">Needed?</th></tr></thead>
        <tbody>
          <tr><td>Sign-in session (set by Supabase)</td><td>Keeps you signed in</td><td>Yes, when you sign in</td></tr>
          <tr><td><code>sewana-theme</code></td><td>Remembers light or dark mode</td><td>Convenience only</td></tr>
          <tr><td><code>sewana-lang</code></td><td>Remembers your language</td><td>Convenience only</td></tr>
        </tbody>
      </table>
      <h2>Third-party content</h2>
      <p>Maps load tiles from OpenStreetMap and photos load from our image host. These providers can see your IP address when your browser requests them.</p>
      <h2>Your choices</h2>
      <p>You can clear this storage in your browser settings at any time. You will be signed out, and your theme and language will reset.</p>
    </LegalPage>
  );
}
