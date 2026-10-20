import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { I18nProvider } from "@/components/i18n-provider";
import { siteUrl } from "@/lib/seo";
import "./globals.css";
import "./concierge.css";
import "./theme.css";
import "./screens.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "RentalHub Sri Lanka | Home Rentals", template: "%s | RentalHub Sri Lanka" },
  description: "A personal approach to Colombo rentals. Submit a private rental request and let our local team coordinate thoughtful introductions.",
  openGraph: { siteName: "RentalHub Sri Lanka", type: "website", locale: "en_LK" },
  twitter: { card: "summary" },
};

// Applies the saved theme before first paint to avoid a flash; falls back to the system preference via CSS.
const THEME_SCRIPT = `try{var t=localStorage.getItem("rentalhub-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head><body>
    <I18nProvider><AuthProvider>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader />
    <main id="main-content" className="container">{children}</main>
    <SiteFooter />
    </AuthProvider></I18nProvider>
  </body></html>;
}
