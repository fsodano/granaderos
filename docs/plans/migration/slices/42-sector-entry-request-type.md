# Slice 42: the saved sector entry request type takes the canonical stem

**Branch:** `migration/sector-entry-request-type`
**Intent:** Remove the retired vocabulary from the published type that
describes the request to enter a sector.

## Why this slice exists

[Slice 38](38-sector-entry-request.md) gave the saved field its canonical
name, but the type it holds kept the old one: `CampaignPendingBattle`. The
ubiquitous language's canonical term is `SectorEntryRequest`, and "pending
battle" is exactly the vocabulary the migration retires: a request to enter a
sector is not a battle that is pending.

Two types carry that request today. The application layer has the narrow
`SectorEntryRequest` in
`packages/game/application/sector-sessions/enter-sector/sector-entry.request.ts`,
and the campaign snapshot has the richer projection of the same request, named
after the retired field.

The campaign's own projection takes the canonical stem with its own prefix,
`CampaignSectorEntryRequest`, and the glossary records the pair and the
reason: the canonical concept is `SectorEntryRequest`, and the campaign
snapshot carries its own richer projection of it.

## What it changes

- `packages/game/public/campaign-types.ts` declares `CampaignSectorEntryRequest`
  instead of `CampaignPendingBattle`. The shape does not change.
- Every importer of the type uses the new name.

## What it does not change

The request's shape, the rules that read it, and every saved value.

## Tests

- The existing entry, campaign and restoration tests keep passing, which proves
  the request still describes the same thing.

## Verification

- `npm test` passes.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.46` to `0.2.47`.
