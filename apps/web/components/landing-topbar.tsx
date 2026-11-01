"use client";
import Link from "next/link";
import { AuthTopbar } from "@/components/auth-topbar";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/components/i18n-provider";

/** The landing page's top bar: Sign in for visitors, and a way back to their own area once signed in. */
export function LandingTopbar() {
  const t = useT();
  const { user, loading, isAdmin, role } = useAuth();
  if (loading) return <AuthTopbar />;
  if (!user) return <AuthTopbar><Link className="topbar-link" href="/login">{t("nav.signIn")}</Link></AuthTopbar>;
  const adminArea = isAdmin && role === "ADMIN";
  return <AuthTopbar><Link className="topbar-link" href={adminArea ? "/admin" : "/renter/dashboard"}>{t(adminArea ? "nav.admin" : "nav.activity")}</Link></AuthTopbar>;
}
