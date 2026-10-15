"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { AccessRedirect } from "./access-redirect";
export function RequireSession({ children }: { children: ReactNode }) {
  const { user, loading, error, permissionsLoading, profileError } = useAuth();
  const pathname = usePathname();
  if (loading) return <p role="status">Checking your session...</p>;
  if (!user || error) return <AccessRedirect href={`/login?next=${encodeURIComponent(pathname)}`} message="Sign in to continue." />;
  if (permissionsLoading) return <p role="status">Checking account access...</p>;
  if (profileError) return <section className="panel"><h2>Unable to verify access</h2>
    <p role="alert">{profileError}</p>
    <button onClick={() => window.location.reload()}>Retry</button>{" "}
    <Link href="/listings">Return to homes</Link>
  </section>;
  // Remount private content on account changes to clear the previous user's data.
  return <Fragment key={user.id}>{children}</Fragment>;
}
