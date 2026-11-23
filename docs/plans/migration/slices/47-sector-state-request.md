# Slice 47: use `sectorSession` for the carried sector view

The save envelope and campaign orders use `sectorSession` for the active sector
view. The decoded
[`GameSnapshotContent`](../../../../packages/game/public/game-snapshot-types.ts)
keeps the in-memory field `battle`; that name is not the envelope key or the
campaign-order property.

## Order contract

Orders that carry the active sector view use `sectorSession`, including
`fightOnArrival`, `resumeSectorSession`, `battleResult`, `leaveSector`,
`finishMission`, `syncTacticalTime`, and `talkNPC`. The public
[`CampaignAction`](../../../../packages/game/public/campaign-types.ts) type does
not declare `sectorState`, and handlers read the view from `sectorSession`.
An order that requires a view is refused when it supplies the view only under
`sectorState`.

For example, `leaveSector` uses the snapshot in `sectorSession` to reconcile
health and retained sector state. The same snapshot under `sectorState` does
not supply the required field. This contract is covered by
[`sector-session-request.test.ts`](../../../../tests/sector-session-request.test.ts).

The save envelope still reads legacy top-level `battle` only when
`sectorSession` is `undefined`. That save conversion is separate from the
campaign-order property; `sectorState` is not a saved-field alias.
