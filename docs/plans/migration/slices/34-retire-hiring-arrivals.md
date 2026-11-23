# Slice 34: retire the `hiringArrivals` saved field

Supported older campaign saves may contain a `hiringArrivals` array of prepaid
recruitment bookings with travel timestamps. New campaigns do not create that
field. This conversion does not change local recruitment or strategic travel
for combatants already in service.

## Legal recruitment site

A legal recruitment site is a campaign-defined location with recruitment
facilities: a posta, cuartel, puerto, or embarcadero. The player must control
the site, and no enemy group may be waiting for a fight there, occupying it, or
fighting there. During a blockade, the site must also have a posta or cuartel
for land access.

Desk recruitment starts service immediately at the selected legal site; local
recruitment remains in the character's current sector. The conversion follows
the accepted [save-migration policy](../../accepted/domain-architecture.md#implementation-policies)
and uses the canonical [RefundableRecruitmentClaim](../../accepted/ubiquitous-language.md#canonical-terms)
term for a prepaid booking that cannot begin service yet.

## Restoring a legacy booking

Restoration validates each legacy entry against the candidate, booked service
terms, payment, timestamps, and configured recruitment sites. The saved
destination must identify a configured recruitment site; an unknown destination
makes the entry invalid rather than eligible for fallback.

For each valid entry:

- If the planned destination is legal, service starts there at the saved
  campaign time.
- If that known destination is unsafe, restoration uses the current campaign
  location if legal; otherwise, it uses the first legal recruitment site.
- If no recruitment site is legal, restoration converts the booking to a
  `RefundableRecruitmentClaim`.

The optional `refundableRecruitmentClaims` snapshot field stores unresolved
claims. Restoration removes the legacy `hiringArrivals` field.

## Claim lifecycle

A `RefundableRecruitmentClaim` records the candidate, planned destination,
booked service terms, amount paid, and an optional guarantee reference. It has
no travel schedule, and the recruit remains outside the force until service
begins. When campaign processing finds a legal site and the candidate remains
eligible, it retries the claim using the same destination order. Service starts
at that campaign time, the claim is removed, starting equipment is issued once,
and no additional recruitment payment is taken.

The player can cancel a claim from the recruitment screen at the desk.
Cancellation refunds the paid amount and any held guarantee. If the treasury
cannot accept the full refund, cancellation is refused until the player spends
funds.

## Test requirements

Tests must cover:

- A valid legacy booking at a legal destination starts service at the saved
  campaign time, preserves its terms, payment, and guarantee, issues starting
  equipment once, and removes the legacy field.
- A known but unsafe destination falls back to the current location when legal,
  or to the first legal recruitment site otherwise.
- A booking with no legal site becomes a claim; when a site later becomes legal
  and the candidate remains eligible, service starts without another charge.
- Canceling a claim refunds the paid amount and any held guarantee only when
  the treasury has room for the full refund.
- A malformed legacy entry or unknown destination is rejected.
- A save without a legacy booking or existing claim gains no recruit, charge,
  or equipment during this conversion.

Source anchors: [campaign migration and claim processing](../../../../packages/game/campaign.js),
[site selection and claim validation](../../../../packages/game/recruitment-claims.js),
and the [campaign snapshot contract](../../../../packages/game/public/campaign-types.ts).
