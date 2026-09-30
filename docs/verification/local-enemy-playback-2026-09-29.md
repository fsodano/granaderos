# Enemy presentation integrated into the local game

This check applies to the advanced local checkout served at port 3000. Its
starting tracked revision is `eb39ef7e903fa33f1d463b2af0db2de3c66cf93c` with
additional working changes. It is not the smaller published-main release.
[The evidence file](../evidence/local-enemy-playback-2026-09-29.json) records the
14 applied file hashes. Existing files were compared with saved hashes before
application; unrelated work was preserved.

Enemy turns now show observed steps and attacks before the final campaign
commit. Continuous gait survives successive cells. The integration preserves
manual interrupt windows, enemy AP on resume, upper-level movement, and the
existing movement controller. A grenade flight appears before its injuries.
Invalid campaign transitions are rejected before playback. Tool orders cannot
race the visible turn. Only its final synchronized campaign state is saved.

The worker uses a bundled HTTP URL. The original production export check passes
with 1099 files and 993 asset references. Types and all 62 targeted checks pass
in the actual original checkout. In the normal port 3000 San Lorenzo UI, frame
`0:enemy-0:prepare:fire` appears while input is disabled; turn 2 restores input
without browser errors. Browser checks used the separate QA save.

The broader isolated copy ran 3209 checks: 3200 passed, six failed and three
were skipped. Two failures are missing portrait-source manifests in that copy;
both pass in the original checkout. The other four failed reports cover three
campaign-route points: the northern doctor, the Córdoba recapture, and the paid
prisoner rescue. A separate rerun with the previous tactical reducer reproduces all three points (10 checks: three pass, four failed reports and three skips). These remain open; the presentation integration does not close them.

A separate 20-second port 3000 capture used the saved Retiro QA campaign, one
walking actor, 100% scale and center-follow, with test runners stopped. The normal
map control moved Acosta from (23,20) to (23,14). Position updates averaged
16.85 ms (p95 24.2 ms, maximum 25.9 ms); moving display callbacks averaged
8.33 ms (maximum 9.4 ms). There were no long tasks or browser errors. This
route crossed already discovered scenery. The previous measurements remain in
[the retained-scenery check](retained-scenery-movement-2026-09-29.md); most of the
earlier development-to-production gain came from using a production build. Four-pose artwork, sustained loaded
combat performance and full campaign acceptance remain open.


A separate 20-second capture of the normal first San Lorenzo enemy turn, also
at 100%, finished on player turn 2 with seven rendered actors. It captured 196
display callbacks during movement and 91 position changes: position updates
averaged 17.49 ms (p95 25.0 ms; maximum 25.6 ms). No long tasks or long animation
frames were recorded. This is one ordinary combat turn, not a larger-battle or
full-campaign performance acceptance.

The separate published worker correction merged in [PR #126](https://github.com/fsodano/granaderos/pull/126) as `554ceafe617aea03893f056b6b5ec6de48b32c23` after all five checks passed on head `78fe01207022ed076bf73169aa01d9e2b2328872`. The original dirty checkout was not replaced with published main.
