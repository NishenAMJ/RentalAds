"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { useT } from "./i18n-provider";

/** Header link to the inbox with an unread badge. The count refreshes whenever the route changes. */
export function NotificationsLink({ pathname }: { pathname: string }) {
  const [unread, setUnread] = useState(0);
  const t = useT();
  useEffect(() => {
    let active = true;
    apiRequest<{ count: number }>("/notifications/unread-count", { authenticated: true })
      .then((result) => { if (active) setUnread(result.count); })
      .catch(() => { if (active) setUnread(0); });
    return () => { active = false; };
  }, [pathname]);
  return (
    <Link href="/notifications" aria-current={pathname === "/notifications" ? "page" : undefined}>
      {t("nav.notifications")}
      {unread > 0 && <span className="nav-badge" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
