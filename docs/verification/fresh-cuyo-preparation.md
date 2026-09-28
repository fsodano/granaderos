# Fresh Cuyo preparation and late commander recruitment

One untouched stock campaign now reaches saved phase 4 with the Cuyo prerequisites
paid and San Martín physically recruited. It continues the same mixed force from
Retiro through the accepted [coast](fresh-coastal-opening.md) and
[north](fresh-northern-opening.md). The final historical campaign remains open.

Source: `0ae7f73a30c917d14632d1ed8e81f880da51ef7e`.
[Recorded checkpoints](../evidence/fresh-cuyo-preparation-2026-09-28.json).

## Method and acceptance

`tests/fresh-cuyo-route.test.mjs` runs the complete fresh prefix and then the actual
Mendoza, Uspallata and Los Patos maps. Each fight records ordinary orders against
visible targets. A replay synchronizes every order with campaign time, saves at
midpoint and compares final troops, civilians, random state and elapsed time.
No victory, territory, personnel, money, health or equipment is injected.

The controller reserves AP for firing, treats bleeding, uses prone fire and clears
obsolete remembered positions. This successful strategy also rejects fire through
visible civilians. The separate [Mendoza loss route](historical-campaign-loss.md)
remains verified: civilian casualties and a campaign defeat are still possible.

The force pays for six existing-locality fortifications, workshop service, a
controlled Córdoba arrival and five Charleville muskets before Mendoza. After the
victory, a living soldier with actual dressings stops Beltrán's bleeding. A living
speaker with sufficient leadership approaches and recruits him. His health is not
reset. Attempted early recruitment of San Martín is rejected by the original gate.

The foundry preparation and Pehuenche agreement are paid once. Beltrán stays in
Mendoza while two paid replacements arrive there and receive purchased muskets.
The survivors win both mountain battles, use available finite care and fortify
each captured locality. Deaths remain permanent, including the original created
actor and the later hired casualties.

A paid week renewal keeps Soria in service through 72 hours of ordinary income.
Three purchased swivel guns cost 1,200 pesos and army funding costs 3,000 pesos.
Only then does the campaign reach phase 4. Duplicate funding is rejected. Actual
travel returns to Mendoza, where a qualified speaker approaches San Martín and
recruits him into permanent unpaid service. Save/reload retains the commander,
prepared foundry, treaty, artillery and paid army without granting the final win.

Release checks: **799/799 tests**, zero failures or skips (199,436 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (202 requirements, all 50 original and 87 parity rows,
41 evidence records). [PR #64](https://github.com/fsodano/granaderos/pull/64) merged
after [GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36410288477/job/108888618738)
passed at `cb8d997991cf9af9a0ab06ad447c4ac68f854941`.

Final checkpoint: hour 252, second 361, phase 4, 1,150 pesos and nine controlled
localities. Six people form the current squad; San Martín has 88 HP. The engineer
remains alive in Mendoza. Campaign completion and defeat are both false.

## Limits

This accepts one stock seed and mixed-force strategy under the published care and
equipment model. It does not accept every force build, unpaid-only play, the
advanced medical/recapture/rescue paths, an independent authored campaign or live
browser performance. Artillery is bought for the strategic prerequisite; this
route does not claim battlefield artillery acceptance. Four strategic localities
remain enemy-held at this checkpoint, and campaign completion remains false.
This delivery changes verification only, not gameplay rules or difficulty.
