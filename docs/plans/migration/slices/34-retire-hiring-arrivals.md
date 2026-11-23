# Slice 34: retire the hiringArrivals saved field

**Branch:** `migration/retire-hiring-arrivals`
**Intent:** Remove the travelling-recruit mechanic from the saved state, and
convert the campaigns that still carry a recruit on the way.

## Why this slice exists

The ubiquitous language lists `hiringArrivals` as a compatibility name to
retire, and the accepted architecture's save-migration policy says: "Validated
prepaid recruitment becomes immediate service at the saved game instant, using
the planned safe destination or another available safe recruitment site.
Preserve the payment and guarantee receipt; issue equipment once. If every
site is unsafe, preserve the refundable prepaid claim until a legal site
becomes available."

The code says the mechanic is already dormant. `hireArrivalOrder`, the
function that booked a travelling recruit, has no caller, and every character
in the shipped campaign has `arrivalHours: 0`. The field survives only in
campaigns saved by an earlier version, and new campaigns still seed an empty
`hiringArrivals` array that every save then carries.

The owner decided to retire it as the accepted plan states.

## What it changes

- A new campaign no longer carries the field.
- A restored campaign that still carries a pending arrival is converted: the
  recruit joins the service immediately, at the planned destination when that
  is a legal recruitment site and at another legal site otherwise. The payment
  and the guarantee receipt are preserved, and the equipment is issued once.
- When no legal site exists, the claim is kept as a refundable claim, which
  the player can cancel at the desk for the money back.
- The recruitment screen stops showing a count of pending incorporations and
  the copy that says a recruit is on the way.

## What it does not change

No rule of combat, no price, and no saved value other than the retired field.
A campaign that has nothing pending restores exactly as before.

## The name of the remaining claim

The surviving refundable claim is a different thing from a travelling
recruit: it is money already paid for a recruit who cannot start yet. It
therefore needs its own name, and the glossary records it as a canonical term
with its scope, owner, lifecycle and Spanish translation.

## Tests

- A test proves that a restored campaign with a pending arrival hires the
  recruit immediately, keeps the payment and the guarantee, and issues the
  equipment once.
- A test proves that a pending arrival whose destination is not a legal
  recruitment site is hired at another legal site.
- A test proves that a pending arrival with no legal site anywhere becomes a
  refundable claim that the desk can cancel for the money back.
- A test proves that a campaign with nothing pending restores unchanged.
- The existing save and restoration tests keep passing.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.38` to `0.2.39`.
