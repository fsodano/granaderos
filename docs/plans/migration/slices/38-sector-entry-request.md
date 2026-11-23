# Slice 38: name the saved sector-entry request

## Field meaning

[`CampaignSnapshot`](../../../../packages/game/public/campaign-types.ts) is the
campaign portion of a [`GameSnapshot`](../../../../packages/game/public/game-snapshot-types.ts)
save envelope.
Its `sectorEntryRequest` field records a request to enter a sector; the active
sector view is the separate envelope field `sectorSession`. The saved request
uses `CampaignSectorEntryRequest`, a campaign projection of the narrower
application `SectorEntryRequest`. A request can lead to a peaceful visit, so
`pendingBattle` does not describe the saved value.

## Compatibility contract

[`decodeSave`](../../../../packages/game/save.ts) reads legacy campaign field
`pendingBattle` only when `sectorEntryRequest` is absent, then removes the
legacy field. If both fields are present, `sectorEntryRequest` wins. Encoding
writes the request only under `sectorEntryRequest`.

## Behavior to preserve

- New saves store the request under `campaign.sectorEntryRequest` through
  [`encodeSave`](../../../../packages/game/save.ts).
- A save with only `campaign.pendingBattle` restores the same request and
  re-encodes it under `sectorEntryRequest`.
- The request's data and the rules that consume it remain unchanged.
