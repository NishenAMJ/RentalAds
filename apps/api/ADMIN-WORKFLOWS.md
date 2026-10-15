# Admin workflows

All admin routes use the same `AdminPermissionGuard` and permission metadata.
`role` is not part of authorization. The flags on the current user's database
`admin_permissions` row are authoritative. Missing flags deny access.

| Permission | Operations | Frontend |
| --- | --- | --- |
| canApproveListings | Pending listings, approve/reject, private requests, matching | /admin/listings, /admin/requests |
| canManageComplaints | List complaints and change their status/notes | /admin/complaints |
| canManageAdmins | POST /admin/permissions | API only |

The header loads the current account's flags from `/users/me`. It refreshes them
when the browser regains focus, and hides links after sign-out/account changes.
The server checks permissions on every protected request even if the browser's
display has not refreshed yet. The global AuthModule and PrismaModule supply
shared providers.

## Complaints

POST /complaints permits anonymous submissions. When an Authorization header is
present, the token must pass Supabase verification; invalid tokens return 401.
The reporter ID is the verified user's database ID, or absent for anonymous or
unprovisioned accounts. `reporterId` is not accepted in the JSON body.
The `website` honeypot is never persisted and a non-empty value returns 400.

PATCH /complaints/:id accepts a UUID and `{ status, adminNotes? }`. Status must be
OPEN, REVIEWING or RESOLVED; notes must be a string of at most 5,000 characters.

## Matching

Approved listings have an immutable `reference`, for example `SL-000001`. Migration
`20260920000000_listing_references` creates the unique index, sequence and approval
trigger, and backfills active inventory. Pending/rejected submissions do not receive
references. The database allocates references atomically when status becomes ACTIVE;
later edits/status changes preserve them. Sequence gaps are expected after rolled-back
transactions, and references are identifiers, not an inventory count. Apply migrations;
`prisma db push` alone does not install this trigger.

Admins can search references (case-insensitive) or UUIDs in the listing management
page via `GET /listings/admin/lookup/:identifier`. This protected endpoint returns
private owner contact and can find inactive listings. The per-request candidate lookup
accepts the same references but continues to require an active listing. Both require
`canApproveListings`. Existing property URLs and stored match IDs still use UUIDs.

Admin match results include owner contact and listing reference. The WhatsApp template
includes only the listing reference and its existing public property information; it
never incorporates the private owner-contact field. Public listing responses expose
the reference alongside the existing privacy-safe fields, without owner contact.

- GET /matching/requests/:id/suggestions computes paginated suggestions without writes.
- POST /matching/requests/:id/suggestions with `{ listingId }` explicitly saves one
  suggestion, recalculating score and rechecking the current requirements.
- PATCH /matching/matches/:id/status with `{ status }` updates a saved match to
  SUGGESTED, SENT, INTERESTED, NOT_INTERESTED or RENTED. IDs must be UUIDs.

Closed requests cannot generate or save new suggestions; inactive properties cannot be recommended. All active properties appear as potential options, including below 50%. Area matches rank first, followed by score and stable ID. Each criterion is explained as matched, different, unspecified or unverified.

The score is out of 85: area 30, budget 15, property type 10, bedrooms 10, size 5, parking 5, stay 5, furnishing 5. Unspecified optional preferences earn their available points. Budget fit retains a price-sensitive score within the accepted range. Percentages describe preference fit, not a probability or renter confirmation.

A differing preference or unverified location requires `recommendationReason` in the save payload. The server derives `recommendedByAdminId` and records `recommendationReviewedAt`. Reasons must be nonblank and at most 1,000 characters. Existing location-only audit fields remain compatible; a legacy location-only reason cannot approve unrelated differences. See `../../PERIMETER_SEARCH.md` for privacy and rollout details.

Saving again updates score without resetting an existing status. The admin
request page shows Save match, then a status dropdown. Copy message only copies
text; it does not send WhatsApp messages or automatically mark a match SENT.
Statuses record admin decisions; they do not automatically close requests or
change a listing's availability.


## Listing reference verification (20 September 2026)

The reference migration is applied to the configured database; all 3 active listings
have references. A transaction-local temporary table verified the real approval trigger,
including pre-approval null references, unique allocation and immutability through status
changes. No real listing approvals or messages were created by tests.

40 API unit tests, 116 HTTP tests and 27 frontend tests passed, together with TypeScript,
changed-source lint and both production builds. Desktop/mobile synthetic browser checks
confirmed reference lookup, private owner-contact display, and copied WhatsApp text
containing the reference without owner contact.
