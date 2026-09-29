# Walking frame continuity

Runtime source: `762c96715de5814f7757207a951480f14cc8b92d`.

The gait clock previously included time spent waiting for the next cell. After
a 120 ms movement and a 450 ms wait, the next cell started at animation time
570 ms. At five authored frames per second this jumped from pose zero to pose
two. A late endpoint callback could also add time after movement had finished.

The clock now carries only completed movement time into the next cell. The
same example resumes at 120 ms. Separate orders still start a new cycle,
unobserved enemy movement remains hidden, and a waiting actor needs no animation
callbacks. This changes presentation only; routes, AP, energy and campaign time
keep their existing rules.

Illustrated sprites and their shadows also keep fractional screen positions.
Previously nine positions separated by one eighth of a pixel collapsed into
two positions. The renderer now displays all nine. Illustrated art uses smooth
sampling; the native pixel fallback retains integer alignment and sharp sampling.

Three new regression checks fail on the previous source and pass after the
change. Ten focused checks and twelve rendered-scene checks pass. The complete
suite passes **1247/1247**, with no failures or skips, on test source
`bc530c869910922fa59f39b2b8eb8b9f2f4045aa`. Types, the production export (723
files, 633 asset references) and 36 baseline comparisons pass.
[The evidence file](../evidence/walking-frame-continuity.json) records exact sources
and log checksums. Ordinary production controls move Cabral four cells at the
expected 32 AP cost, then complete an enemy turn and restore input without
console errors. This is a presentation check, not a combat-victory assertion.

The same correction is integrated into the advanced local port 3000 checkout.
A separate Retiro QA walk at 100% scale records phases `0,1,2,3,0,1,2,3` through
normal map clicks, with fractional positions in every moving sample. That
visible-browser capture runs near 30 FPS on battery power at 18%; it does not
establish a speed improvement over the earlier 120 Hz capture. The local file
hashes and bounded capture are recorded separately in the evidence.

## Limits

The existing illustrated walking art still has four poses at five frames per
second. Repeated leg positions remain an artwork problem. Four generated
candidates failed visual review and none replaced the runtime art. This delivery
does not establish JA2 animation parity, sustained loaded-combat performance or
full campaign completion. Those parent requirements remain open.
