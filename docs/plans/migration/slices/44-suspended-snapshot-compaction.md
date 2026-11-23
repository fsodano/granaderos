# Slice 44: compact suspended visit snapshots

`suspendedSectorSessions` stores suspended visits as saved requests and sector
snapshots, with resumption context in the runtime record. Save encoding changes
only how eligible terrain tiles in each saved snapshot are represented.

## Save behavior

[`compactSaveTerrain`](../../../../packages/game/save-terrain.js) and
[`expandSaveTerrain`](../../../../packages/game/save-terrain.js) walk the
active view, retained maps, the sector-entry resume snapshot, and every
`suspendedSectorSessions[*].snapshot`. Eligible suspended tile arrays use the
same palette encoding as other sector views; decoding restores the original
tile data. `palette-v1` stores each distinct tile shape once and records an
index for each map cell. The terrain codec replaces only the `tiles` array;
normal save validation still applies after decoding.

## Example and behavior contract

The test fixture's suspended visit has a 100x100 repeated-tile map. Its
campaign saves smaller when [`encodeSave`](../../../../packages/game/save.ts)
writes `snapshot.tiles` as `palette-v1`, and
[`decodeSave`](../../../../packages/game/save.ts) restores the original
dimensions and tile array. The request, units, turn, phase, and sector identity
are also checked after restore. The behavior is covered by
[`suspended-save-compaction.test.ts`](../../../../tests/suspended-save-compaction.test.ts).

Compaction does not change map behavior or the saved visit's gameplay state.
Suspended snapshots use the same compact-file and expanded-save limits as the
active and retained sector maps.
