# UI review — 18 September 2026

## Coverage

Inspected the landing page, login/signup code, property browsing/detail, renter request/dashboard, owner submission/dashboard, all four admin screens, shared navigation and fallback states.

Browser checks ran at 1440px and 390px in an isolated headless Edge profile. Authentication and API responses used synthetic fixtures; no real accounts, listings, requests or complaints were modified. The browser audit visited every main route and the not-found page at both widths, verified the expected pathname/headings, and detected no horizontal overflow after fixes. Password show/hide was exercised at both widths without losing the entered value or submitting the form.

## Changes

- Added a labeled, keyboard-operable password visibility button to login and signup. It starts hidden, preserves autocomplete and input identity, cannot submit the form, and resets when switching modes.
- Removed the signup-only eight-character restriction from the login form so existing credentials are not blocked by client-side signup rules.
- Brought the renter dashboard into the shared visual system with readable statuses, loading skeletons and useful empty states.
- Added private-request entry points to browsing and property-detail pages; added a no-photo fallback.
- Standardized pagination and admin record spacing; fixed long identifiers, action wrapping and malformed listing separators.
- Fixed admin desktop overflow caused by a full-width container plus a sidebar margin. On narrow phones, admin navigation now sits above content instead of occupying a permanent side rail.
- Added a public-site return link for admins.
- Fixed the request wizard button wrapping on narrow screens and replaced the ambiguous privacy glyph with a lock icon.
- Labeled the complaint-report field, added a cancel action, and announced successful reports.
- Added branded not-found and recoverable error pages. Keyed property details by property ID to avoid showing the previous property during route changes.

## Checks and limits

- Automated suite: 26 tests passing, including password visibility regression coverage.
- TypeScript and ESLint pass; production build passes.
- The reusable browser runner is `scripts/ui-audit.mjs`; it requires an isolated browser exposing local debugging port 9333 and the web app on port 3000. Screenshots and route results are saved outside the app at `D:/RentalAds/.tmp/ui-audit`.
- Fixture checks validate presentation and navigation, not live authentication, database changes, image uploads or WhatsApp delivery. The error boundary was checked by compilation/source review rather than forcing a production exception.
