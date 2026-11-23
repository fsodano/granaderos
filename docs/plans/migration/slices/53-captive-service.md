# Slice 53: captive service contract rules

Capture pauses the unused part of a serving combatant's service contract. The
domain owns the remaining-service calculation and the contract reconstruction
that runs when the combatant returns to service.

## Domain rules

[`captive-service.ts`](../../../../packages/game/domain/personnel/captive-service.ts)
exports `captiveServiceHours` and `restoredCaptiveContract`.
`captiveServiceHours` reports no value when the record is not captured or has no
saved captive contract. It derives non-negative remaining hours from the saved
contract expiry and capture time, including within-hour seconds; a contract
without an expiry has unbounded remaining service. On release,
`restoredCaptiveContract` requires a captured record with a saved captive
contract, keeps a non-expiring contract open, or sets a finite expiry to
release time plus the remaining hours. An exhausted contract is not restored.

## Retained query

[`prisoner-custody.js`](../../../../packages/game/prisoner-custody.js)
re-exports the domain functions for existing callers and retains
`prisonerStatus`. That query reads campaign character and detention records to
build the status view; it delegates the service-hours calculation to the
domain rule rather than owning a second implementation.

[`campaign.js`](../../../../packages/game/campaign.js) and
[`prisoner-escape-return.js`](../../../../packages/game/prisoner-escape-return.js)
continue to use the retained module path when rebuilding a contract.
