# Slice 41: name the retained sector and scene snapshots

## Field meaning

[`CampaignSnapshot`](../../../../packages/game/public/campaign-types.ts)
stores `sectorSnapshots`, a map from sector IDs to retained physical snapshots,
and `sceneSnapshots`, a map from mission-scene IDs to retained snapshots.
These maps preserve sector contents without taking
ownership of character identity or item custody. They are distinct from the
campaign's `sectors` ownership map and the active envelope field
`sectorSession`.

## Compatibility contract

[`decodeSave`](../../../../packages/game/save.ts) reads legacy `sectorStates`
only when `sectorSnapshots` is absent, and reads legacy `sceneStates` only
when `sceneSnapshots` is absent. Each current map wins independently when both
names occur, and decoding removes the legacy names. Encoding writes only
`sectorSnapshots` and `sceneSnapshots`.

## Behavior to preserve

- New saves store retained maps under `campaign.sectorSnapshots` and
  `campaign.sceneSnapshots` through
  [`encodeSave`](../../../../packages/game/save.ts).
- A save with only legacy `sectorStates` or `sceneStates` restores the same
  maps and re-encodes them under the current names.
- Map contents, world evolution, character identity, and item custody remain
  unchanged.
