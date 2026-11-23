# Slice 37: name the saved sector view

## Saved representation

[`GameSnapshot`](../../../../packages/game/public/game-snapshot-types.ts) is
the portable save envelope. It writes the active sector view under
`sectorSession`; the view can represent deployment, exploration, or combat, so
it is not necessarily an active battle. [`SectorSession`](../../accepted/ubiquitous-language.md#canonical-terms)
names the visit. The decoded
[`GameSnapshotContent`](../../../../packages/game/public/game-snapshot-types.ts)
is a separate in-memory `{ campaign, battle }` pair; its `battle` property is
not an envelope key.

[`decodeSave`](../../../../packages/game/save.ts) selects top-level
`sectorSession` whenever that key is present. It reads legacy top-level `battle`
only when `sectorSession` is absent. If both keys occur, `sectorSession` wins,
including when its value is `null`. Encoding and terrain compaction use the
same field precedence. `sectorState` remains a campaign-action request property
([`CampaignAction`](../../../../packages/game/public/campaign-types.ts)) that
carries a sector snapshot; it is not a saved field.

## Behavior to preserve

- [`encodeSave`](../../../../packages/game/save.ts) writes the active view
  under `sectorSession` and omits top-level `battle`, including when there is
  no active view.
- A save with only legacy `battle` restores to the same in-memory pair.
  Encoding that pair writes the view under `sectorSession`.
- When both envelope keys occur, the value under `sectorSession` is
  authoritative. Terrain expansion and compaction follow that same choice.
- The sector snapshot contents and gameplay rules do not change.
