"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";

export function AdminSidebar() {
  const { permissions } = useAuth();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const links = [
    { href: "/admin", label: "Overview", visible: true },
    { href: "/admin/activity", label: "Activity history", visible: true },
    { href: "/admin/listings", label: "Listings", visible: permissions.canApproveListings },
    { href: "/admin/users", label: "Users", visible: permissions.canManageAdmins },
    { href: "/admin/verifications", label: "Owner verification", visible: permissions.canManageAdmins },
    { href: "/admin/requests", label: "Rental requests", visible: permissions.canApproveListings },
    { href: "/admin/bookings", label: "Bookings", visible: permissions.canApproveListings },
    { href: "/admin/payouts", label: "Owner payouts", visible: permissions.canManagePayouts },
    { href: "/admin/complaints", label: "Complaints", visible: permissions.canManageComplaints },
    { href: "/", label: "View public site ↗", visible: true },
  ];

  return (
    <aside className={`admin-sidebar${expanded ? " is-expanded" : ""}`}
      onKeyDown={event => {
        if (event.key === "Escape") {
          setExpanded(false);
          event.currentTarget.querySelector<HTMLButtonElement>(".admin-menu-toggle")?.focus();
        }
      }}>
      <Link className="brand" href="/admin" onClick={() => setExpanded(false)}>
        RentalHub<span>Sri Lanka</span>
      </Link>
      <p className="eyebrow">Administration</p>
      <button className="admin-menu-toggle secondary" aria-expanded={expanded}
        aria-controls="admin-navigation" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Close menu" : "Menu"}
      </button>
      <nav id="admin-navigation" aria-label="Admin navigation"
        className={`admin-side-links${expanded ? " is-expanded" : ""}`}>
        {links.filter(link => link.visible).map(link => (
          <Link key={link.href} href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            onClick={() => setExpanded(false)}>
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
