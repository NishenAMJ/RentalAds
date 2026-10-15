"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

export function HomeAccess({ children }: { children: ReactNode }) {
  const { loading, permissionsLoading, isAdmin, role, profileError } = useAuth();
  const openAdmin = role === "ADMIN" && isAdmin && !profileError;
  const router = useRouter();
  useEffect(() => {
    if (!loading && !permissionsLoading && openAdmin) router.replace("/admin");
  }, [loading, permissionsLoading, openAdmin, router]);
  if (loading || permissionsLoading || openAdmin)
    return <p role="status">{openAdmin ? "Opening admin dashboard..." : "Loading..."}</p>;
  return children;
}
