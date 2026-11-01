# Privacy-safe perimeter search

Implemented on 18 September 2026. The additive migration
`20260918000000_private_perimeter` has been applied to the configured database.
No existing listing coordinates were changed or inferred.

## Admin potential matching update (20 September 2026)

Admin matching now lists every active property for open requests, including options below 50%. Area matches rank first, followed by score and a stable ID tie-break. Each option explains area, budget, property type, bedrooms, size, parking, stay length and furnishing as matched, different, unspecified or unverified. Perimeter assessment uses exact coordinates; missing pins are unverified. Text-only requests use area text.

Preferences are soft for discovery. Recommending an option with differences or an unverified location requires `recommendationReason` (1?1,000 nonblank characters). The API records `recommendedByAdminId` from the authenticated administrator and `recommendationReviewedAt`. Inactive properties and closed requests remain blocked. Ordinary updates preserve audit metadata. Legacy location-only reasons cannot approve unrelated preference differences.

Migration `20260919000000_potential_match_reviews` adds nullable audit fields and has been applied to the configured database. Existing recommendation scores remain historical until reassessed. Public browsing, approximate location privacy and radius filtering are unchanged.

Listings are read in batches of 250; dashboard requests in batches of 50 share listing reads. A bounded heap retains only the requested page and lookahead. Ranking still examines all active candidates, so very large inventories/request counts or deep pages can require more processing.

Current verification: 37 API unit tests, 114 HTTP tests (the full 113-test suite plus the new review regression), 27 frontend tests, API/frontend TypeScript, matching-source/frontend lint, and both production builds passed. Synthetic desktop (1440 px) and mobile (390 px) browser checks passed without horizontal overflow. The read-only database check found 3 active properties, 2 without pins; both latest Maharagama requests now return 3 potential properties with the in-area home first. No real recommendations or messages were created by verification.

## Original perimeter rollout behaviour (admin rules superseded above)

- Optional centre and radius on the private renter request: 3 km initially, adjustable from 1–10 km. Typed preferred areas remain required. These are initial Colombo defaults, not measured optimal distances.
- Public points use a stable 0.0036-degree grid (approximately 400 m around Colombo). Public lists/details never serialize exact coordinate fields or owner contact. Public map links are rebuilt from the grid point; legacy links without structured coordinates are suppressed.
- Public inclusion, ordering and distance use the grid point. Admin suggestions use exact coordinates. Consequently a property near a boundary can appear in a public preview but not in exact admin suggestions, or vice versa. The preview is labelled “Homes near your selected area,” not confirmed matches.
- Missing-pin properties remain in ordinary browsing but are excluded from radius results and automatic perimeter suggestions. Text-only request matching is unchanged.
- Owners retain exact data for their own listings. Protected admin endpoints retain exact data for administration. There is no public exact-location consent switch.

## API and storage

`GET /listings?searchLatitude=6.9271&searchLongitude=79.8612&searchRadiusKm=3&page=1&limit=6`

All three geographic fields must be supplied together, finite, and in range. The same nullable fields persist on rental requests. Public results include `approximateLocation: { latitude, longitude } | null` and, for radius searches, `approximateDistanceKm`. The distance displayed is rounded to two decimal places; sorting uses the unrounded approximate distance, then listing ID. Ordinary browsing keeps its original ordering.

Both paths call the single `distanceKm` implementation in `apps/api/src/common/geography.ts`. The indexed bounding box limits candidate reads; public bounds expand to complete intersecting grid cells. Candidates are fetched in batches of 250, retaining the top rows required for the requested page and lookahead, before pagination. This MVP still examines all candidates inside the bounding box; dense areas and very deep numbered pages cost more work.

Admin routes all require verified authentication and `canApproveListings`:

- `GET /matching/requests/:id/suggestions`: area-first potential suggestions with exact location assessment.
- `GET /matching/requests/:id/candidates/:listingId`: active-listing lookup, exact distance and eligibility warning.
- `POST /matching/requests/:id/suggestions`: `listingId`, optionally `recommendationReason` (or legacy `locationOverrideReason`).
- `GET /matching/requests/:id/matches`: paginated recorded recommendations and audit fields.
- `PATCH /matching/matches/:id/status`: ordinary status update preserving audit metadata; closed requests cannot be updated.

Overrides require a nonblank reason (at most 1,000 characters), an outside-radius or missing-pin property, and an administrator resolved server-side. `locationOverrideReason`, `locationOverrideAdminId` and `locationOverrideAt` are persisted. Inactive listings remain blocked. Preference differences now require the general recommendation review described above.

## Rate limiting and deployment

Throttler infrastructure is registered. Radius queries—including incomplete/invalid geographic queries—share a 20-request/60-second bucket per resolved client IP. Ordinary browsing skips this guard. Complaint creation has its own 2-request/60-second bucket. Tests exercise actual HTTP 429 responses.

By default Express does not trust proxy headers. Throttling reads server-resolved `req.ip`; arbitrary `X-Forwarded-For` values do not change the bucket. If deployed behind a reverse proxy, set `TRUSTED_PROXY_CIDRS` to that infrastructure's exact IP addresses/CIDRs only. The proxy must strip or replace client-supplied forwarding headers and direct access to the origin should be restricted. Do not configure universal ranges or trust an arbitrary hop count.

Counters are in memory and scoped to one API process. They reset when that process restarts. Before running multiple API replicas, use shared throttler storage or an equivalent gateway limit; otherwise the effective limit multiplies across instances. Stable grid coordinates and throttling mitigate different probing methods and both must stay enabled.

For another environment, run `pnpm --filter db exec prisma migrate deploy` and `pnpm --filter db generate` before starting the dependent API build. Restart an already-running API so it uses the generated client and updated guards. The current environment migration has already been applied.

## Initial coverage and query-plan check

The configured database contained **2 active listings, both missing coordinates** at verification. Initial radius coverage is therefore zero. Add a verified pin by re-submitting a listing or through trusted database tooling; do not geocode or guess an occupied property's location. Ordinary browsing still shows both homes.

Run `node scripts/check-perimeter-rollout.cjs` from `apps/api` to recheck coverage and the index. The script prints only counts and a query plan. It creates 120,000 synthetic rows in a transaction-local temporary table and never writes synthetic listings into production tables.

Observed plan: `Bitmap Index Scan on perimeter_plan_coordinates` followed by a bitmap heap scan and sort; 112 candidates, 8 heap blocks, approximately 0.55 ms execution time in this sample. This demonstrates index selection on the representative data, not a production latency guarantee.

## Verification

Completed: 30 API unit tests, 112 HTTP tests, 27 frontend tests, API TypeScript, API source lint, frontend lint, and both production builds. Desktop/mobile browser checks passed for circle/marker rendering, click selection, marker dragging, radius changes, stale-response rejection, tile-error fallback/retry, step preservation, clearing, review, submission, rate-limit/empty feedback, exact admin distances and recorded overrides. No horizontal overflow was detected across the audited routes.

API tests cover stable public serialization and links, distance boundaries, expanded grid bounds, filtering before pagination across batches, missing pins, request persistence and validation, shared-distance invocation, rate limits, override permissions and audit preservation, and non-location rejections. Existing text-only and authorization tests remain in place.

The synthetic browser audit in `apps/web/scripts/ui-audit.mjs` covers 1440 px desktop and 390 px mobile layouts. It replaces API/auth traffic inside an isolated browser and does not create real listings, requests, matches or messages. Run with `UI_AUDIT_BASE` pointing to the frontend and an isolated headless Edge instance on debugging port 9333. Screenshots and results are written outside the repository to `D:/RentalAds/.tmp/perimeter-audit`.
