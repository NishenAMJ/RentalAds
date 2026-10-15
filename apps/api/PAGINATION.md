# Collection pagination

All collection GET endpoints accept `page` (default 1, maximum 1,000,000) and
`limit` (default 20, maximum 100). Both must be positive integers; invalid values
return HTTP 400. Authentication and permission requirements are unchanged.

- `GET /listings`
- `GET /listings/mine`
- `GET /listings/pending` (requires `canApproveListings`)
- `GET /requests`
- `GET /requests/mine`
- `GET /complaints`
- `GET /matching/requests/:id/suggestions`

Example: `GET /requests/mine?page=2&limit=20`

```json
{
  "data": [],
  "page": 2,
  "limit": 20,
  "hasNextPage": false
}
```

This replaces the previous bare-array response. Consumers must read `data`.
An empty or out-of-range page returns an empty array with `hasNextPage: false`.
No total count is calculated; the database reads one extra row as lookahead.
Standard collections use database skip/take and order by createdAt descending,
then ID descending to break ties. Concurrent inserts/deletes can shift offset
pages; this is not a snapshot across multiple requests.

Matching suggestions are ranked by score descending, then listing ID ascending.
The previous fixed top-five cutoff is removed. The admin UI requests five
suggestions at a time. Candidate listings are fetched in batches of 250; ranking
still scans all active candidates to preserve global score order. GET only reads
data and returns saved `matchId`/`status` when present. To save a selected suggestion,
POST `{ "listingId": "..." }` to `/matching/requests/:id/suggestions`.
Ranking retains only enough top results for the requested offset and lookahead.
Deep pages therefore cost more work and memory than early pages.

Single-record endpoints and mutation results (including the bounded image upload
batch response) are not collection browsing endpoints and keep their shape.

Frontend collection pages expose Previous/Next and Retry controls. Private pages
remain inside the shared session guard and clear their data on account changes.
