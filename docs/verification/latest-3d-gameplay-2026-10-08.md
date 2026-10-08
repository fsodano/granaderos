# Latest accepted 3D changes in gameplay

The final normal gameplay check uses main
`5f65ef08d51659fe1fa10d4f2a85f586dca78123`, with build identity `e4176a47c77b`.
It includes accepted faces from [PR #284](https://github.com/fsodano/granaderos/pull/284),
the selected sabre thrust and contact continuity from
[PR #286](https://github.com/fsodano/granaderos/pull/286), door bands from
[PR #288](https://github.com/fsodano/granaderos/pull/288), and military clothing
from [PR #289](https://github.com/fsodano/granaderos/pull/289).
The later [PR #290](https://github.com/fsodano/granaderos/pull/290) corrects
integration tests and leaves these runtime and asset bytes unchanged.

The check creates male and female campaigns through the normal portrait,
job and sector controls. Standing, crouched and prone actions complete.
Menu return and reload retain portrait, job, equipment, ammunition and clothing.
Normal San Lorenzo combat fires one owned Charleville charge, then reloads
from finite reserves. The displayed AP is 25 → 22.25 → 11.75, loaded charges
are 1 → 0 → 1, and reserve cartridges are 12 → 12 → 11.

All eight body families load at all three detail levels. Each captured
100-actor view has 100 loaded actors and zero pending models. The 622 served
model, bank and texture responses match the frozen local bytes. All 241
tracked source inputs remain exact during the check. Browser and asset
error lists are empty. The two animation banks retain the selected PR #286
hashes recorded in the receipt.

The [source and gameplay receipt](../art/reviews/latest-3d-gameplay/receipt.json)
contains the actual normal-control cases and served hashes. These images
were inspected:

- [Male campaign](../art/reviews/latest-3d-gameplay/male-battle.png)
- [Female campaign](../art/reviews/latest-3d-gameplay/female-battle.png)
- [Current bodies at LOD0](../art/reviews/latest-3d-gameplay/all-appearances-zoom-3.png)
- [Paid finite reload](../art/reviews/latest-3d-gameplay/san-lorenzo-finite-reload.png)

Repeat with `node tools/verify-three-character-gameplay.mjs` against the
local game server. The tool uses fresh browser contexts and ordinary game
controls; it does not replace renderer poses or saved state.

The user ended this 3D iteration. No accepted completed art or motion cut
remains unmerged. The clinical, prone loading, knife/canana, arch and ceiling
trials remain private because their acceptance checks were incomplete or
failed. This check establishes integrated assets and the stated gameplay
paths. It does not establish every motion, complete clothing clearance,
portrait likeness or sustained frame performance.
