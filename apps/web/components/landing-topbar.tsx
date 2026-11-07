"use client";
import Link from "next/link";
import { AuthTopbar } from "@/components/auth-topbar";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/components/i18n-provider";
import { landingDestination } from "@/lib/login-destination";

/** The landing page's top bar: Sign in for visitors, and a way back to their own area once signed in. */
export function LandingTopbar() {
  const t = useT();
  const { user, loading, isAdmin, role, permissions, permissionsLoading } = useAuth();
  const navigation = <>
    <Link className="topbar-link" href="/categories">{t("nav.explore")}</Link>
    <Link className="topbar-link" href="/renter/new">{t("nav.find")}</Link>
    <Link className="topbar-link" href="/owner/start">{t("nav.owners")}</Link>
  </>;
  if (loading || (user && permissionsLoading)) return <AuthTopbar navigation={navigation} />;
  if (!user) return <AuthTopbar navigation={navigation}><Link className="topbar-link" href="/login">{t("nav.signIn")}</Link></AuthTopbar>;
  const adminArea = isAdmin && role === "ADMIN";
  const destination = landingDestination(role, permissions);
  const label = destination === "/login" ? t("nav.signIn") : adminArea ? t("nav.admin") : role === "OWNER" ? t("nav.myProperties") : t("nav.activity");
  return <AuthTopbar navigation={navigation}><Link className="topbar-link" href={destination}>{label}</Link></AuthTopbar>;
}
