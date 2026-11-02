# Product and operations readiness

This is the working list of decisions to settle before accepting real users and payments. The deployment procedure is in [DEPLOYMENT.md](DEPLOYMENT.md); this document covers the service and the people who need to operate it.

## Current product model

- **Homes:** renters submit private requests; the team reviews them and coordinates potential introductions. No home rent is collected by the platform and a match is not guaranteed.
- **Vehicles, equipment and event gear:** renters select dates and pay through PayHere. The checkout total is rental price, the configured service fee (10% by default), and any owner-set refundable deposit.
- **Payments and refunds:** refunds are sent manually through PayHere and recorded by an admin. The admin payout ledger records owner amounts due and transfers marked paid, but it does not execute transfers. Deposit custody and returns remain manual and have no separate ledger.
- **Trust:** listings are reviewed before publication. Owners can request verification; staff record a manual check completed outside the app, and verified status appears on listing details. The app stores no identity documents and does not define the check standard. Renters can leave one numeric rating per completed, paid item booking; only the listing's average and count are public. There are no written reviews.

## Open decisions and launch actions

The current checklist lives in [REMAINING-WORK.md](REMAINING-WORK.md). Keep that file as the single source of truth so product, business, and launch tasks do not drift across duplicate checklists. Deployment-specific steps remain in [DEPLOYMENT.md](DEPLOYMENT.md).

## Suggested first-pilot policy

Keep the current renter-visible service fee and manual payment operations only for a small, explicitly scoped pilot. Publish the owner payout and deposit rules before owners submit items. Describe precisely what the manual owner check covers; it is not a guarantee of listing quality, safety or rental performance. A rating reflects a renter's completed booking and is not an independent inspection. Expand categories or areas only after the support and reconciliation process has been exercised with real transactions.

The suggested pilot is a starting point, not a substitute for deciding the fee, payout, deposit, and legal terms above.
