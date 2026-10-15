# Sewana Lanka: concierge design system

## Visual language

Use a quiet, editorial layout with generous space, warm surfaces and purposeful calls to action. Lead with private requests and personal introductions. Never imply an automated match, guaranteed response time, verified property inspection or public access to contact details.

Tokens live in `app/concierge.css`, imported after the legacy stylesheet. Tailwind aliases expose the same semantic colors and typography. Existing pages inherit shared controls, typography and surfaces; the three redesigned screens use the new component classes.

| Token | Value | Use |
| --- | --- | --- |
| Background | `#f8f7f2` | Warm ivory canvas |
| Foreground | `#203e35` | Primary text |
| Primary | `#214f40` | Main actions and emphasis |
| Secondary | `#e7eee3` | Sage supporting surfaces |
| Surface | `#ffffff` | Forms and property cards |
| Muted | `#607168` | Supporting text |
| Brass | `#92703c` | Small decorative accents |
| Success | `#245b3c` on `#e7f2e8` | Active/confirmed |
| Warning | `#80551c` on `#faf0d9` | Pending review |
| Danger | `#a3322c` on `#fff0ec` | Errors/rejected |

Use Iowan Old Style / Palatino / Georgia for display headings and Segoe UI / Arial for body and controls. Fonts are local fallbacks, so rendering does not depend on external font requests. Body inputs are 16px; supporting text is 12–14px. Display sizes scale with the viewport. Controls use 10px corners and cards use 20px. Primary buttons have a 48px minimum height.

## Component architecture

- **Atoms:** `Button`, `ActionLink`, shared input styles, focus rings, spinner and skeleton shapes.
- **Molecules:** `InputField`, `SelectField`, `Badge`, `PrivacyNote`, `EmptyState`, `SkeletonCards` in `components/ui/primitives.tsx`.
- **Organisms:** `RenterRequestForm`, `OwnerPropertyCard`, site navigation and the paginated owner workspace.
- **Screens:** server-rendered landing page; authenticated request page composing the client form; authenticated owner dashboard composing API-backed cards.

Exported TypeScript interfaces define component props. Native button/input/select elements preserve keyboard and form semantics without additional component dependencies. If dialogs or custom popovers are introduced, use an accessible primitive rather than implementing focus trapping by hand.

Public cards consume `PublicListing`. Owner cards consume `OwnerListing` only under authentication; they never render `ownerContact`. Never spread a database record into public-facing markup.

## Interaction contracts

- Renter flow: area → budget and duration → home preferences → review and WhatsApp number. Continue validates only the visible step; final submission validates every step.
- Back preserves answers. Final submit is protected from duplicate clicks. Failure preserves the form. Success explains the manual next step and links to request tracking.
- Draft contact details stay in component memory, not local storage. Leaving or refreshing the page clears an unsent draft.
- Bathroom preferences are not supported by the existing request API. The form explicitly asks users to discuss that requirement with the team; it does not present an input that loses data.
- Owner summaries are explicitly page-local because the existing API supplies pagination, not aggregate totals. No misleading global counts or client-only filters over partial data.
- Availability confirmation has a busy state, a dismissible persistent live-region confirmation, and a recoverable error state. Loading uses skeletons. Empty/error states always provide a next action.
- Every field has an associated label. Errors use `aria-invalid` and `aria-describedby`; form-level errors receive focus. Step changes focus the heading. Status badges include text as well as color.
- Honor reduced motion. Maintain visible keyboard focus and the skip-to-content link. Mobile layouts collapse to one column without changing the semantic order.

## Verification

Run `npm test`, `node node_modules/typescript/bin/tsc --noEmit`, and `npm run build` in `apps/web`. Request validation/payload tests are in `tests/listing-form.test.mjs`; route and authorization regressions remain in `tests/auth.test.mjs`.
