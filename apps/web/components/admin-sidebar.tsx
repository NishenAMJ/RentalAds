"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";

type IconName = "overview" | "activity" | "listings" | "users" | "verify" | "requests" | "money" | "bookings" | "complaints" | "external";

export function AdminSidebar() {
  const { permissions } = useAuth();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const links: { href: string; label: string; icon: IconName; visible: boolean }[] = [
    { href: "/admin", label: "Overview", icon: "overview", visible: true },
    { href: "/admin/activity", label: "Activity history", icon: "activity", visible: true },
    { href: "/admin/listings", label: "Listings", icon: "listings", visible: permissions.canApproveListings },
    { href: "/admin/users", label: "Users", icon: "users", visible: permissions.canManageAdmins },
    { href: "/admin/verifications", label: "Owner identity checks", icon: "verify", visible: permissions.canManageAdmins },
    { href: "/admin/requests", label: "Rental requests", icon: "requests", visible: permissions.canApproveListings },
    { href: "/admin/commissions", label: "Commissions & fees", icon: "money", visible: permissions.canManageCommissions || permissions.canManagePayouts },
    { href: "/admin/bookings", label: "Bookings", icon: "bookings", visible: permissions.canApproveListings },
    { href: "/admin/payouts", label: "Owner payouts", icon: "money", visible: permissions.canManagePayouts },
    { href: "/admin/complaints", label: "Complaints", icon: "complaints", visible: permissions.canManageComplaints },
    { href: "/", label: "View public site", icon: "external", visible: true },
  ];

  return <aside className={`admin-sidebar${expanded ? " is-expanded" : ""}`}
    onKeyDown={event => {
      if (event.key === "Escape") {
        setExpanded(false);
        event.currentTarget.querySelector<HTMLButtonElement>(".admin-menu-toggle")?.focus();
      }
    }}>
    <Link className="brand" href="/admin" onClick={() => setExpanded(false)}>RentalHub<span>Sri Lanka</span></Link>
    <p className="eyebrow">Administration</p>
    <button className="admin-menu-toggle secondary" aria-expanded={expanded} aria-controls="admin-navigation" onClick={() => setExpanded(!expanded)}>{expanded ? "Close menu" : "Menu"}</button>
    <nav id="admin-navigation" aria-label="Admin navigation" className={`admin-side-links${expanded ? " is-expanded" : ""}`}>
      {links.filter(link => link.visible).map(link => <Link key={link.href} href={link.href}
        aria-current={pathname === link.href ? "page" : undefined} aria-label={link.label} title={link.label}
        onClick={() => setExpanded(false)}><AdminNavIcon name={link.icon} /><span className="admin-link-label">{link.label}</span></Link>)}
    </nav>
  </aside>;
}

function AdminNavIcon({ name }: { name: IconName }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "overview": return <svg {...common}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></svg>;
    case "activity": return <svg {...common}><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>;
    case "listings": return <svg {...common}><path d="M5 5h15M5 12h15M5 19h15"/><circle cx="2.5" cy="5" r=".5"/><circle cx="2.5" cy="12" r=".5"/><circle cx="2.5" cy="19" r=".5"/></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.5M18 14a5 5 0 0 1 3.5 5"/></svg>;
    case "verify": return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
    case "requests": return <svg {...common}><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5M8 2v4M16 2v4"/></svg>;
    case "money": return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>;
    case "bookings": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></svg>;
    case "complaints": return <svg {...common}><path d="M4 4h16v13H9l-5 4z"/><path d="M12 8v4M12 15h.01"/></svg>;
    default: return <svg {...common}><path d="M14 3h7v7M10 14 21 3M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>;
  }
}
