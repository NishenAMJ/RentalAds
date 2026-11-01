export type AccountRole = "RENTER" | "OWNER" | "ADMIN";
type Permissions = {
  canApproveListings: boolean;
  canManageAdmins: boolean;
  canManageComplaints: boolean;
};

/** An item's own page, so signing in to book returns there. Only a UUID is accepted, never an arbitrary path. */
const ITEM_PAGE = /^\/item\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loginDestination(next: string | null, role: AccountRole | null, permissions: Permissions): string {
  const isAdmin = permissions.canApproveListings === true || permissions.canManageAdmins === true || permissions.canManageComplaints === true;
  // Administrators always start at the dashboard, whatever page they were sent to sign in from.
  if (role === "ADMIN" && isAdmin) return "/admin";
  if (next && (["/listings", "/owner/new", "/owner/listings", "/renter/new", "/renter/dashboard", "/bookings", "/owner/bookings", "/owner/start"].includes(next) || ITEM_PAGE.test(next))) return next;
  if (isAdmin && (next === "/admin" ||
    (next === "/admin/complaints" && permissions.canManageComplaints === true) ||
    (["/admin/listings", "/admin/requests", "/admin/bookings"].includes(next ?? "") && permissions.canApproveListings === true))) return next!;
  if (role === "RENTER") return "/renter/dashboard";
  if (role === "OWNER") return "/owner/listings";
  return "/listings";
}
