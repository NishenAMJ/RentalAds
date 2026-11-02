"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { RequireSession } from "@/components/require-session";
import { AccessRedirect } from "@/components/access-redirect";

function AdminAccess({ children }: { children: ReactNode }) {
  const { isAdmin, permissions, permissionsLoading } = useAuth();
  const path = usePathname();
  if (permissionsLoading) return <p role="status">Checking admin access...</p>;
  const permitted = isAdmin && (path === "/admin" ||
    path === "/admin/activity" ||
    (path === "/admin/complaints" && permissions.canManageComplaints) ||
    (path === "/admin/payouts" && permissions.canManagePayouts) ||
    (["/admin/listings", "/admin/requests", "/admin/bookings"].includes(path) && permissions.canApproveListings));
  if (!permitted) return <AccessRedirect href={`/login?next=${encodeURIComponent(path)}`}
    message="Your account does not have permission to view this admin page." />;
  return children;
}
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireSession><AdminAccess>{children}</AdminAccess></RequireSession>;
}
