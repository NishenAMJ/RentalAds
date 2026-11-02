# Product and operations readiness

This is the working list of decisions to settle before accepting real users and payments. The deployment procedure is in [DEPLOYMENT.md](DEPLOYMENT.md); this document covers the service and the people who need to operate it.

## Current product model

- **Homes:** renters submit private requests; the team reviews them and coordinates potential introductions. No home rent is collected by the platform and a match is not guaranteed.
- **Vehicles, equipment and event gear:** renters select dates and pay through PayHere. The checkout total is rental price, the configured service fee (10% by default), and any owner-set refundable deposit.
- **Payments and refunds:** refunds are sent manually through PayHere and recorded by an admin. Owner payouts and deposit returns are also manual; there is no payout ledger or automated payout flow.
- **Trust:** listing submissions are reviewed, but owners are not formally identity-verified and listings have no user reviews or ratings.

## Decisions required before the item-booking pilot

- [ ] **Choose who bears the service fee.** The current checkout adds it to the renter's total. Confirm this is the intended commercial policy and disclose it in owner terms as well as renter checkout.
- [ ] **Define owner payout terms.** Specify the amount paid to the owner, what happens to the service fee and deposit, payout method, payout schedule, minimum payout threshold if any, and how cancellations or chargebacks affect it.
- [ ] **Define deposit custody and disputes.** State who holds the deposit, when it is returned, what evidence is needed for a damage claim, how each side can respond, and who makes the final decision.
- [ ] **Assign a person and response target for support.** Cover failed or late payments, cancellations, deposit disputes, unsafe listings, owner no-shows, and account/privacy requests. The app does not currently promise response times.
- [ ] **Confirm the launch scope.** Select the first categories and geographic areas, and confirm there is enough reviewed supply and support capacity for them.
- [ ] **Set an identity and listing-check policy.** Decide what documents or evidence owners must provide, who checks them, how long they are retained, and how the site describes checks it does not perform.

## Decisions required before public launch

- [ ] Replace `hello@rentalhub.example` with a monitored support address through `NEXT_PUBLIC_CONTACT_EMAIL`.
- [ ] Have a Sri Lankan lawyer review the terms, privacy notice, cookie notice, refund language, deposit process and item-booking relationship. Keep `LEGAL_DRAFT` enabled until that review is complete.
- [ ] Have native Sinhala and Tamil speakers review the interface and legal/help text before promoting those languages.
- [ ] Assign an operator to reconcile PayHere payments, refunds, owner payouts and deposits against booking records. Record the PayHere reference for every manual transfer.
- [ ] Exercise the complete sandbox process, including payment, renter cancellation, owner cancellation, refund, and the manual owner payout procedure.

## Suggested first-pilot policy

Keep the current renter-visible service fee and manual payment operations only for a small, explicitly scoped pilot. Publish the owner payout and deposit rules before owners submit items. Do not imply formal identity verification or a guaranteed match. Expand categories or areas only after the support and reconciliation process has been exercised with real transactions.

The suggested pilot is a starting point, not a substitute for deciding the fee, payout, deposit, and legal terms above.
