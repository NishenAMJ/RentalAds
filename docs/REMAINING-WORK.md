# Remaining work

This is the canonical backlog for product, business, trust, and launch readiness. AI agents must read it before making repository changes and update it in the same change when implementation or scope affects an item; see the repository [AGENTS.md](../AGENTS.md).

Statuses describe the current repository and decisions still needed. A completed code feature does not mean its operating policy, payment setup, or launch exercise is complete.

## Recently implemented

- Listing owners can remove individual photos and set item pickup pins; public pages expose only approximate map locations.
- Staff can record an owner verification decision after a manual check outside the app. The app does not collect identity documents.
- Renters can submit one numeric rating per completed, paid item booking. Public pages show the listing average and count; there are no written reviews.
- Admins can record owner payouts, booking disputes, refunds, account moderation, and admin activity. These records do not themselves move money.
- **Property commission model (BR-001).** Admin-configurable 30 % of one month's agreed rent (default). Admins with the `canManageCommissions` permission can create, adjust, and record commissions and listing-fee alternatives. A commission record is created automatically when a match is marked RENTED.
- **Owner identity & authority check terminology (BR-002/D-003).** "Verified" language replaced with "identity & authority confirmed / checked" across all public-facing UI and i18n strings. Internal DB enum values (`VERIFIED`, `REJECTED`) are unchanged to avoid a breaking migration.
- **Islandwide scope.** The homes pilot is not restricted to Colombo. The search area picker now includes Kandy, Galle and Gampaha quick-start buttons; help text updated to "islandwide across Sri Lanka".
- **Item rental isolation for homes pilot.** `ENABLED_CATEGORIES=PROPERTY` is now the documented default in `.env.example`. The booking service already blocks PROPERTY listings from the item booking flow (`isItemCategory` check). Item and vehicle booking is switched off during the pilot.
- API and web container runtime stages now install production dependencies and run as the unprivileged `node` user.
- Account deletion now requires and calls Supabase identity deletion before anonymising app data; missing credentials or provider failures are reported as failures so users can retry. Set `SUPABASE_SERVICE_ROLE_KEY` for this feature.
- PayHere success callbacks now re-read and conditionally claim a booking inside the transaction, preventing concurrent duplicate notifications from processing it twice. Sandbox exercise remains open below.

## Product and engineering

- [ ] **Multi-unit item bookings — product decision and implementation.** Event-gear `quantity` is currently informational; a booking reserves one unit. Decide which categories need multiple units, how owners declare available inventory, and how simultaneous bookings reserve quantities before changing the booking model.
- [ ] **Shared rate limiting — needed before multiple API replicas.** Limits are held in process memory. Keep one API instance until shared throttler storage or an equivalent gateway limit is configured and verified.
- [ ] **Written reviews — optional product feature.** Current feedback is numeric only. Add comments only with an agreed moderation, reporting, privacy, and appeal process.
- [ ] **Recheck account export/deletion tests.** The account test fixture now covers rating export/deletion, verification-data cleanup, and the requirement that Supabase identity removal succeeds before account anonymisation. Rerun `test/account.spec.ts`, then confirm the full API suite passes after these account-data changes.

## Business and operating decisions

- [ ] **Service-fee policy and unit economics.** The renter currently pays the configured service fee. Confirm who should bear it and compare fee revenue with payment fees, refunds, support labor, and owner acquisition costs.
- [ ] **Owner payout terms.** Define payout calculation, method, schedule, thresholds, and how cancellations or chargebacks affect payouts. The admin ledger records due amounts and transfers marked paid but does not execute transfers.
- [ ] **Deposit custody and disputes.** Define who holds deposits, when they are returned, what evidence supports damage claims, how both parties respond, and who decides outcomes. Deposit handling remains manual and has no separate ledger.
- [ ] **Support ownership and response targets.** Assign an operator and targets for payment failures, cancellations, deposit disputes, unsafe listings, owner no-shows, and privacy/account requests.
- [ ] **Pilot scope and supply.** Homes pilot is islandwide across Sri Lanka (D-010 revised). Confirm reviewed supply and support capacity before inviting renters. Item and vehicle bookings remain switched off until financial reconciliation, deposit handling, refund workflows, payment validation, and inventory controls are addressed (see BR-003, BR-004, BR-006).
- [ ] **Owner-check standard.** Define what the manual verification check means, who can perform it, what evidence may be reviewed outside the app, whether and where that evidence is retained, and how the badge's limits are explained. Do not request uploads through this app; it has no identity-document storage or review controls.
- [ ] **Rating rules.** Decide how to handle suspected manipulation and disputes, and how to explain averages based on few bookings. Current ratings have no written comments.

## Before public launch

- [ ] **Contact address.** Replace `hello@rentalhub.example` with a monitored support address through `NEXT_PUBLIC_CONTACT_EMAIL`.
- [ ] **Legal review.** Ask Sri Lankan counsel to review terms, privacy and cookie notices, refunds, deposits, and the item-booking relationship. Keep `LEGAL_DRAFT` enabled until review is complete.
- [ ] **Language review.** Have native Sinhala and Tamil speakers review the interface and legal/help text before promoting those languages.
- [ ] **Payment setup and sandbox exercise — waiting on PayHere setup.** The webhook now rechecks payment state inside the booking transaction to prevent concurrent duplicate callbacks from processing the same payment twice. Once the owner configures merchant access, test successful, failed, and late payments; renter and owner cancellations; refunds; notifications; and payout reconciliation. Do not configure credentials or switch to live mode without the owner's setup and instructions. The sandbox has not yet been exercised.
- [ ] **Financial reconciliation procedure.** Assign an operator to reconcile PayHere transactions, refunds, deposits, and owner payouts against bookings; record provider references for manual transfers.
- [ ] **Verification and rating exercise.** Use the agreed policies to exercise a completed booking rating and a staff-recorded owner verification request and decision.
- [ ] **Reliability exercise.** Run a load check for expected pilot traffic and practise restoring a database backup.

For deployment steps and environment configuration, see [DEPLOYMENT.md](DEPLOYMENT.md). For business context and the current product model, see [LAUNCH-READINESS.md](LAUNCH-READINESS.md).
