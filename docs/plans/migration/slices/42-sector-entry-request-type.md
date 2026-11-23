# Slice 42: name the saved sector-entry request type

## Type roles

[`SectorEntryRequest`](../../../../packages/game/application/sector-sessions/enter-sector/sector-entry.request.ts)
is the narrow application input to `EnterSector`. The campaign snapshot stores
a richer public projection of the same concept as
[`CampaignSectorEntryRequest`](../../../../packages/game/public/campaign-types.ts)
at `CampaignSnapshot.sectorEntryRequest`; suspended visit records use that
same campaign projection. The `Campaign` prefix marks the saved projection, not
a different request.

The public type in
[`packages/game/public/campaign-types.ts`](../../../../packages/game/public/campaign-types.ts)
is `CampaignSectorEntryRequest`. `CampaignPendingBattle` misnamed a request
that may describe a peaceful visit and is no longer a published type. The
legacy save field `pendingBattle` remains a separate compatibility concern:
[`decodeSave`](../../../../packages/game/save.ts) reads it only when
`sectorEntryRequest` is absent.

## Behavior to preserve

- Public callers use `CampaignSectorEntryRequest` for the campaign snapshot
  projection and retain `SectorEntryRequest` for the application input.
- The type rename does not change request fields, saved values, or rules.
- Legacy `pendingBattle` save conversion remains governed by the field-name
  compatibility contract.
