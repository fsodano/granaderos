# Slice 53: the captive service rules into the domain

**Branch:** `migration/captive-service`
**Intent:** Move the rules that pause a contract while its holder is in custody
into the domain, beside the service contract they pause.

## Why this slice exists

`packages/game/prisoner-custody.js` holds three things.

Two rules: how many hours of a contract a captive has left, and how the
contract is rebuilt when the captive is released. The comment says why they
exist: capture pauses the unused portion of a contract, and neither the status
panel nor the release may charge for, or grant service during, detention.

One query: the status of a prisoner, which reads the campaign's records and
the care given in detention.

The domain already owns the service contract: `ServiceContract` holds its
terms, its start and its expiry, and knows whether it is active at an instant.
Pausing it belongs with the contract.

## What it changes

- `packages/game/domain/personnel/captive-service.ts` holds the two rules.
- `packages/game/prisoner-custody.js` keeps the query and re-exports the two
  rules from the domain, and the files that import them keep importing them
  from the same path.

The hours and the rebuilt contract do not change.

## Tests

- `packages/game/domain/personnel/captive-service.test.ts` covers the rules:
  a combatant who was never captured has no remaining hours, a captive with a
  contract that never expires has an unbounded remainder, a captive with an
  expiry has the hours between the capture and the expiry, and a released
  captive's contract expires at the release plus the hours that were left.

## Verification

- `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.57` to `0.2.58`.
