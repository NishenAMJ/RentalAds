"use client";
import Link from "next/link";
import { useT } from "./i18n-provider";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="site-footer">
      <div><strong>Sewana Lanka</strong><br />{t("footer.tagline")}</div>
      <nav className="footer-links" aria-label="Legal">
        <Link href="/privacy">{t("footer.privacy")}</Link>
        <Link href="/terms">{t("footer.terms")}</Link>
        <Link href="/cookies">{t("footer.cookies")}</Link>
      </nav>
      <span>{t("footer.location")}</span>
    </footer>
  );
}
