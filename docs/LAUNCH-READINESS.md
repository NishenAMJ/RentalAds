# Product and operations readiness

This is the working list of decisions to settle before accepting real users and payments. The deployment procedure is in [DEPLOYMENT.md](DEPLOYMENT.md); this document covers the service and the people who need to operate it.

## Current product model

- **Homes:** renters submit private requests; the team reviews them and coordinates potential introductions. No home rent is collected by the platform and a match is not guaranteed.
- **Vehicles, equipment and event gear:** renters select dates and pay through PayHere. The checkout total is rental price, the configured service fee (10% by default), and any owner-set refundable deposit.
- **Payments and refunds:** refunds are sent manually through PayHere and recorded by an admin. The admin payout ledger records owner amounts due and transfers marked paid, but it does not execute transfers. Deposit custody and returns remain manual and have no separate ledger.
- **Trust:** listings are reviewed before publication. Owners can request verification; staff record a manual check completed outside the app, and verified status appears on listing details. The app stores no identity documents and does not define the check standard. Renters can leave one numeric rating per completed, paid item booking; only the listing's average and count are public. There are no written reviews.

## Decisions required before the item-booking pilot

- [ ] **Choose who bears the service fee.** The current checkout adds it to the renter's total. Confirm this is the intended commercial policy and disclose it in owner terms as well as renter checkout.
- [ ] **Define owner payout terms.** Specify the amount paid to the owner, what happens to the service fee and deposit, payout method, payout schedule, minimum payout threshold if any, and how cancellations or chargebacks affect it.
- [ ] **Define deposit custody and disputes.** State who holds the deposit, when it is returned, what evidence is needed for a damage claim, how each side can respond, and who makes the final decision.
- [ ] **Assign a person and response target for support.** Cover failed or late payments, cancellations, deposit disputes, unsafe listings, owner no-shows, and account/privacy requests. The app does not currently promise response times.
- [ ] **Confirm the launch scope.** Select the first categories and geographic areas, and confirm there is enough reviewed supply and support capacity for them.
- [ ] **Set an identity and listing-check policy.** Define what the manual check means, who performs it, what evidence may be reviewed outside the app, whether and where that evidence is retained, and how limitations are explained. Do not ask owners to upload identity documents through this app; it has no document storage or review controls.
- [ ] **Set rating rules.** Explain what a rating represents, how disputes or suspected manipulation are handled, and how low-count averages are presented.
- [ ] **Check unit economics.** Compare service-fee revenue with PayHere fees, refunds, support time and owner acquisition costs; confirm the pilot can operate at the intended booking volume.

## Decisions required before public launch

- [ ] Replace `hello@rentalhub.example` with a monitored support address through `NEXT_PUBLIC_CONTACT_EMAIL`.
- [ ] Have a Sri Lankan lawyer review the terms, privacy notice, cookie notice, refund language, deposit process and item-booking relationship. Keep `LEGAL_DRAFT` enabled until that review is complete.
- [ ] Have native Sinhala and Tamil speakers review the interface and legal/help text before promoting those languages.
- [ ] Assign an operator to reconcile PayHere payments, refunds, owner payouts and deposits against booking records. Record the PayHere reference for every manual transfer.
- [ ] Exercise the complete sandbox process, including payment, renter cancellation, owner cancellation, refund, and the manual owner payout procedure.
- [ ] Exercise a completed booking through the renter rating flow, and record an owner verification request and staff decision using the agreed policy.
- [ ] Run a load check for the expected pilot traffic and practise restoring a database backup.

## Suggested first-pilot policy

Keep the current renter-visible service fee and manual payment operations only for a small, explicitly scoped pilot. Publish the owner payout and deposit rules before owners submit items. Describe precisely what the manual owner check covers; it is not a guarantee of listing quality, safety or rental performance. A rating reflects a renter's completed booking and is not an independent inspection. Expand categories or areas only after the support and reconciliation process has been exercised with real transactions.

The suggested pilot is a starting point, not a substitute for deciding the fee, payout, deposit, and legal terms above.
