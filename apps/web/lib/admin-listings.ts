import type { OwnerListing } from "@/lib/listings";

export type ListingStatus = OwnerListing["status"];
export type ListingAction = "approve" | "reject" | "deactivate" | "reactivate";

export const STATUS_TABS: readonly { status: ListingStatus; label: string; empty: string }[] = [
  { status: "PENDING_APPROVAL", label: "Pending", empty: "No listings are waiting for review." },
  { status: "ACTIVE", label: "Active", empty: "No listings are live right now." },
  { status: "INACTIVE", label: "Inactive", empty: "No listings are switched off." },
  { status: "REJECTED", label: "Rejected", empty: "No listings have been rejected." },
];

/** Moderation actions available for a listing in each status. Deleting is offered for every status. */
export const ACTIONS_BY_STATUS: Record<ListingStatus, readonly { action: ListingAction; label: string; danger?: boolean }[]> = {
  PENDING_APPROVAL: [{ action: "approve", label: "Approve listing" }, { action: "reject", label: "Reject submission", danger: true }],
  ACTIVE: [{ action: "deactivate", label: "Deactivate listing", danger: true }],
  INACTIVE: [{ action: "reactivate", label: "Reactivate listing" }],
  REJECTED: [],
};

export const ACTION_MESSAGES: Record<ListingAction, string> = {
  approve: "Listing approved",
  reject: "Listing rejected",
  deactivate: "Listing deactivated and hidden from the public",
  reactivate: "Listing is live again",
};

/** Response of GET /admin/summary; each section is present only if the admin may manage it. */
export interface AdminSummary {
  listings?: { pending: number; active: number; inactive: number };
  requests?: { open: number; unassigned: number };
  bookings?: { upcoming: number; refundDue: number };
  payouts?: { dueCount: number; dueAmount: number };
  complaints?: { open: number };
}
