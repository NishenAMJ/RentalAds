export type AccountRole = "RENTER" | "OWNER" | "ADMIN";
type Permissions = {
  canApproveListings: boolean;
  canManageAdmins: boolean;
  canManageComplaints: boolean;
};

export function loginDestination(next: string | null, role: AccountRole | null, permissions: Permissions): string {
  if (next && ["/listings", "/owner/new", "/owner/listings", "/renter/new", "/renter/dashboard"].includes(next)) return next;
  const isAdmin = permissions.canApproveListings === true || permissions.canManageAdmins === true || permissions.canManageComplaints === true;
  if (isAdmin && (next === "/admin" ||
    (next === "/admin/complaints" && permissions.canManageComplaints === true) ||
    (["/admin/listings", "/admin/requests"].includes(next ?? "") && permissions.canApproveListings === true))) return next!;
  if (role === "RENTER") return "/renter/dashboard";
  if (role === "OWNER") return "/owner/listings";
  return role === "ADMIN" && isAdmin ? "/admin" : "/listings";
}
