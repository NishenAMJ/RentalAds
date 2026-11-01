# Rental Platform — v0 pilot

The pilot includes persistent users, photo uploads, listing submission and moderation,
rental requests, admin matching, and complaint handling. Deployment remains a
separate step.

## Local setup

Use pnpm from `D:\RentalAds\rental-platform`:

```powershell
pnpm install
pnpm db:generate
pnpm --filter api build
pnpm dev:api
```

In a second terminal, run `pnpm dev:web`. API: `http://localhost:3001`.
Web: `http://localhost:3000`. Prisma CLI and client are pinned to **5.22.0**.
The DB workspace manifest is `packages/db/package.json` (corrected from `packege.json`).
Use `pnpm db:migrate` only for intentional schema changes. No additional migration
is needed for this milestone.
Stop any running API process before regenerating Prisma on Windows; otherwise
its loaded query engine DLL can cause an EPERM rename error.

Environment files are ignored by Git. Never place a service-role key in a
`NEXT_PUBLIC_*` variable. API `.env` needs `DATABASE_URL`, `FRONTEND_URL`, and
Supabase URL and API key. Existing `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` names are supported in the API; server
names `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are preferred. A publishable
or anon key suffices for token verification. Prisma uses API `DATABASE_URL`,
not the browser's Supabase connection. Use the working pooler connection from
your setup, with URL-encoded credentials; keep migrations on session port 5432.

DB `.env` needs `DATABASE_URL` and `DIRECT_URL`. Web `.env.local` needs
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or
`NEXT_PUBLIC_SUPABASE_ANON_KEY`), and `NEXT_PUBLIC_API_URL=http://localhost:3001`.

## API contract

| Route | Access and behavior |
| --- | --- |
| `GET /users/me` | Verified token; creates or returns the current user and their admin permission flags. |
| `POST /listings` | Verified token; creates a pending listing using the caller's database ID. |
| `GET /listings` | Public; active listings only, public field whitelist. |
| `GET /listings/:id` | Public; active listing only, otherwise 404. |
| `GET /listings/mine` | Verified token; caller's listings in any status. |
| `GET /listings/pending` | `canApproveListings`; paginated pending-only review queue. |
| `PATCH /listings/:id/approve` | `canApproveListings`; pending → active. |
| `PATCH /listings/:id/reject` | Same permission; pending → rejected. |
| `PATCH /listings/:id/reconfirm` | Listing owner only; updates timestamp without changing status. |

Unknown body fields, including `ownerId`, `role`, and `status`, are rejected with
400. Money is integer LKR; rent and minimum duration must be positive. Key money
requires a positive amount when enabled and no amount when disabled. Photo and
map URLs must use HTTP(S). New listings require a Sri Lankan mobile number in
`ownerContact`, normalized as `+947XXXXXXXX`. The form supplies the fixed +94
prefix and accepts nine digits starting with 7, with optional spaces or dashes.
Existing database contacts are not rewritten. Apartments require a size;
houses always save `N_A`. Zero bedrooms is allowed for studios.
The owner form accepts up to 10 JPG, PNG, or WebP
photos, 8 MB each, and uploads them immediately on selection to the authenticated
`POST /uploads/property-images` endpoint. Uploaded photos have thumbnail previews
and can be removed from the listing before submission. Pending or failed uploads
block submission. Successfully uploaded URLs are reused if saving the listing
fails and the user retries in the same form. The API needs
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in
`apps/api/.env`; these credentials must never be browser environment variables.
Public responses exclude `ownerContact`, `ownerId`,
and any future fields not explicitly added to the serializer. Free-text fields
and user-provided images/links still require moderation for personal details.

Users first seen through `/users/me` default to RENTER. Users first seen through
listing submission default to OWNER. Existing roles are preserved. Any verified
user may submit their own property; the single role column does not prevent a
renter from also owning a listing. Role input is never accepted from clients.

## Verification

```powershell
pnpm --filter api test --runInBand
pnpm --filter api test:e2e --runInBand
pnpm --filter api check:db
pnpm --filter web lint
pnpm --filter web build
```

HTTP tests use a fake Supabase verifier and in-memory Prisma adapter, while
exercising the real guards, validation, routes, and services. They do not prove
live database persistence or a real Supabase session. Unit tests cover unique
constraint races and conflicting identities.

For a live smoke test, log in through `/login` with an existing confirmed user,
submit a property at `/owner/new`, and check `/owner/listings`. It should show
Pending approval. Use a trusted database administrator to set up the initial
admin: the matching `admin_permissions` row must have `canApproveListings=true`.
Permission flags alone authorize admin operations; role is a display label.
Only accounts with `canManageAdmins` can grant or revoke permissions through
`POST /admin/permissions`. Then use `/admin/listings` to approve or reject listings.
Visit `/listings` and `/property/<id>` and inspect the raw API response to confirm
the contact field is absent. Repeat `/users/me` and verify its database ID stays
the same. Do not paste tokens or passwords into shared logs.

Retool and deployment are not configured by this milestone. A direct database
admin tool bypasses API permission checks; limit its connection and users to
trusted administrators.

### API CORS

Set `FRONTEND_URL` to the exact frontend origin (for example, `https://yourapp.vercel.app`). Only that origin receives CORS permission, with credentials enabled. `WEB_ORIGIN` remains a fallback for existing installations. In production (`NODE_ENV=production`), an explicit origin is required; development defaults to `http://localhost:3000`. Wildcards, multiple origins, URL credentials, paths, queries, and fragments are rejected at startup. Restart the API after changing environment variables. CORS controls browser access; endpoint authentication still applies to other clients.

## Operations and configuration

### Database migrations
Three migrations add reminders, list-query indexes and the admin work queue. Apply them to each
environment before deploying the matching API version:

```powershell
pnpm --filter db exec prisma migrate deploy   # production and staging
pnpm db:migrate                               # local development
```

Then regenerate the client (`pnpm db:generate`) with the API stopped (see the Windows note above).

### API environment (`apps/api/.env`)
| Variable | Purpose |
| --- | --- |
| `LISTING_STALE_DAYS` | Days without owner confirmation before a listing is hidden from public browsing (default 60). |
| `LISTING_REMINDER_DAYS` | Days before an owner is reminded to confirm availability (default 45; always shorter than the stale limit). |
| `DISABLE_SCHEDULER` | `true` switches off background jobs (availability reminders). Reminders are claimed in the database, so running several API instances is safe. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional. Lets "delete my account" also remove the sign-in identity. Server-side only, never in the browser. |

### Web environment (`apps/web/.env.local`)
`NEXT_PUBLIC_SITE_URL` (public origin, used for the sitemap, canonical links and social previews)
and `NEXT_PUBLIC_CONTACT_EMAIL` (shown on the legal pages).

### Health checks
`GET /health` reports that the process is up. `GET /health/ready` also checks the database and
returns 503 when it is unreachable. Point load balancers and uptime monitors at `/health/ready`.
In production (`NODE_ENV=production`) the API writes one JSON object per log line, and every response
carries an `X-Request-Id` header that also appears in the access log.

### Security notes
The API sends security headers (helmet) and marks responses `Cache-Control: no-store` unless a route
opts in; public listing reads are cacheable for 30 seconds. Uploads are checked by their real file
contents, and embedded metadata such as GPS location is stripped on storage. Write routes are rate
limited per client. The web app sends a Content-Security-Policy; `script-src` still allows inline scripts
because Next.js emits them, so moving to nonces is a worthwhile later hardening.

### Languages
Interface text lives in `apps/web/lib/i18n/messages.ts` (English, Sinhala, Tamil). English is the source;
add keys there first. The header, footer, home page, Explore homes and sign-in are translated; other
screens fall back to English until translated. Have a native speaker review the Sinhala and Tamil text.

### Tests
```powershell
pnpm --filter api test           # unit tests
pnpm --filter api test:e2e       # HTTP tests with an in-memory database
pnpm --filter web test           # unit tests
pnpm --filter web test:e2e       # browser tests (Playwright, uses the installed Microsoft Edge)
```
Browser tests build the site into `.next-e2e` and replace Supabase and the API inside each test, so no
accounts or services are needed.
