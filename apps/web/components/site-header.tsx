"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { AdminSidebar } from "./admin-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsLink } from "./notifications-link";
import { LanguageSwitcher } from "./language-switcher";
import { useT } from "./i18n-provider";
export function SiteHeader() {
  const { user, loading, signOut, isAdmin, permissionsLoading } =
    useAuth();
  const navigationLoading = loading || permissionsLoading;
  const t = useT();
  const pathname = usePathname();
  const adminView = isAdmin && (pathname === "/admin" || pathname.startsWith("/admin/"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuExpanded = openPath === pathname;
  async function handleSignOut() {
    setBusy(true);
    setError("");
    try {
      await signOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
    {adminView && !navigationLoading && <AdminSidebar />}
    <header className={`site-header${adminView ? " admin-topbar" : ""}`}>
      {!adminView && <Link className="brand" href="/">
        Sewana<span>Lanka</span>
      </Link>}
      {!adminView && <button type="button" className="site-menu-toggle secondary" aria-expanded={menuExpanded} aria-controls="site-navigation" onClick={() => setOpenPath(menuExpanded ? null : pathname)}>{menuExpanded ? t("nav.closeMenu") : t("nav.menu")}</button>}
      <nav id="site-navigation" className={adminView ? "" : "public-nav"} data-open={menuExpanded} aria-label={adminView ? "Account navigation" : "Main navigation"}>
        {!navigationLoading && !adminView && (
          <>
            <Link href="/listings" aria-current={pathname === "/listings" ? "page" : undefined}>{t("nav.explore")}</Link>
            <Link className="nav-cta" href="/renter/new" aria-current={pathname === "/renter/new" ? "page" : undefined}>{t("nav.find")}</Link>
            <Link href="/owner/new" aria-current={pathname === "/owner/new" ? "page" : undefined}>{t("nav.owners")}</Link>
            {user && (
              <>
                <Link href="/owner/listings">{t("nav.myProperties")}</Link>
                <Link href="/renter/dashboard">{t("nav.myRequests")}</Link>
                <NotificationsLink pathname={pathname} />
                {isAdmin && <Link href="/admin">{t("nav.admin")}</Link>}
              </>
            )}
          </>
        )}
        {navigationLoading ? (
          <span role="status">Checking session...</span>
        ) : user ? (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void handleSignOut()}
          >
            {busy ? "…" : t("nav.signOut")}
          </button>
        ) : (
          <Link href="/login">{t("nav.signIn")}</Link>
        )}
        <LanguageSwitcher />
        <ThemeToggle />
        {user && <Link className="avatar" href="/account" aria-label="Account and privacy"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></Link>}
      </nav>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </header>
    </>
  );
}
