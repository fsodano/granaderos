# Observed enemy turns and retained scenery

Runtime/test source: `180e13ec1e54aa569ec4afca0d69e24c69b9dbee`.

The ordinary end-turn control presents observed movement one cell at a time.
Observed attack preparation appears before its resulting injury. Hidden actors
do not acquire a figure or camera focus through the presentation record. When
an actor first becomes visible, its presentation begins at the observed cell;
its earlier hidden route is not replayed.

The simulation records transient frames without changing its random sequence,
orders, AP, ammunition, injuries or final result. The worker computes the turn;
the interface shows it; the campaign accepts the final state once. Orders are
blocked during playback. Replaced battles, unmounts, invalid campaign transitions
and failed workers cannot commit a stale turn or leave input locked. Frames are
not stored in a campaign save. Normal sounds follow their corresponding frames.

Consecutive enemy steps retain one walking cycle. A 120 ms cell step no longer
restarts a 200 ms authored pose before the next pose can appear. Cell completion
does not briefly show idle while the next cell is pending. A new walk starts a
new cycle. Existing artwork and its frame count remain unchanged.

Static scenery is retained across movement and equivalent room-discovery
descriptions. Changed terrain, doors, lighting, textures and architecture still
invalidate affected layers. Raster resources are released after replacement or
unmount. Sprite action clocks only wake when an authored pose can change.

## Verification

The complete regression passes **1242/1242**, with zero failures or skips, in
279,210 ms. Browser types, the production export (723 files, 632 asset
references), and 36 numerical reference comparisons pass. Exact-head CI remains
required before merge. [Machine-readable results](../evidence/visible-enemy-turns.json)
identify the source and retained check digests.
The new simulations compare presentation with the original authoritative turn,
including actual San Lorenzo attacks. Mounted checks cover duplicate orders,
stale results, unmount, worker failure, campaign rejection and exactly one commit.
Controlled display-clock checks follow eight consecutive enemy cells, observe
every available walking pose and reject animation of an unseen approach.

Existing artillery and militia controls now wait for the actual visible turn
to finish before asserting its saved damage, finite ammunition and promotion.
The registered-order integration check rejects a competing order during the
sequence, then accepts it after the one synchronized campaign save.

The production browser check used the ordinary San Lorenzo start and end-turn
button. It observed the busy state and an intermediate enemy firing result,
then the next player turn with input restored and no console errors. This is a
bounded UI check, not a complete combat route or a frame-rate measurement.

## Limits

The separate development checkout served on port 3000 is ahead of published
main. Its Retiro performance measurements are recorded in
[the dated workspace check](retained-scenery-movement-2026-09-29.md). They must
not be treated as measurements of this branch.

Four-pose illustrated walks still need better intermediate artwork. Exploration
contact, all interrupt cases, larger battles, full sprite-family approval and
complete campaign acceptance remain open. These tests do not establish JA2
visual parity or sustained 60 FPS.
