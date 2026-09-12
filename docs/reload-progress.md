# Loading across turns

Implemented 12 September 2026. An injured soldier can now complete a muzzle-loader even when the full loading cost exceeds the soldier's maximum AP plus carryover.

## Reference and period adaptation

Classic JA2's `GetAPsToReloadGunWithAmmo` selects one reload cost, doubled for an incompatible magazine size. `GetAPsToAutoReload` finds actual ammunition and only includes a second pistol when the combined action is affordable. See the [Stracciatella source, Points.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Points.cc#L1346-L1425).

Granaderos keeps its existing weapon costs and shared cartridge supply. Partial work is an explicit adaptation for black-powder arms, not a claim that classic JA2 supports this loading sequence. A standing Baker still requires 70 AP. Thirty-five AP completes half its work; the remaining half takes 35 AP standing or 53 AP prone. A double-barrel pistol costs 55 AP for two charges; each barrel represents 27.5 AP before posture and specialist modifiers. Costs round up once per action, after applying those modifiers. This replaces the former intermediate rounding for a partial-capacity load.

## Controls and resources

R, the existing reload order, and a firing click with an empty firearm use the same plan. In combat, an order spends up to the available AP. Another order is required to continue after a turn ends. Changing the cursor does not spend AP. The reticle shows **Recarga parcial**, this action's AP, and the work still required.

A completed charge becomes usable immediately and removes one cartridge from reserve and one priming supply when available, as before. An unfinished fraction contains no spendable ammunition. A completed barrel can fire while the other barrel retains unfinished work. An empty weapon with no reserve still shows **Sin munición** and cannot advance its work.

Work belongs to the weapon. Changing hands, moving, treating a wound, dropping, passing, recovering, stealing, or packing that weapon does not put its work onto another gun. Posture and nearby assistance affect the remaining fraction only. Invalid orders retain all work, ammunition, AP, and time.

Enemies and militia use the same loading action. They can kneel when that permits a complete reload now. Otherwise they begin partial work when a fresh AP budget plus carryover cannot finish the current loading cost, or resume work already started. They retain AP for reactions when a later turn can complete an unstarted reload.

Exploration completes the remaining work in the existing action-duration scale without spending combat AP. Saved tactical states retain unfinished work, including interrupt queues and physical items. Packed and ground weapon work also survives campaign reports, saves, and sector reentry. As with existing loaded charges, the ordinary carried primary is returned to the strategic ammunition pool and prepared again during deployment; the campaign does not retain a separate in-hand loading job.

## Verification

Sixteen focused simulation tests cover wounded soldiers over real turns, exact cartridge and AP accounting, separate barrels, changed posture and assistance, invalid orders, missing ammunition, drops, swaps, transfers, malformed saves, autonomous enemy/militia work, a real saved interrupt, a full campaign save, and packed-weapon report/reentry. The reticle render test checks the immediate cost and remaining-work label. Existing empty-gun and combat tests cover the unchanged controls. The opening campaign test keeps its seed, paid recruitment and actual casualties, and now salvages the soldiers who actually fell instead of assuming fixed casualty IDs.

Live verification in the separate `?qa=1` San Lorenzo skirmish passed for the keyboard firing path and R. Barcala fired, reloaded for 42 AP, and fired again, leaving 36 AP and 11 reserve cartridges. The reticle showed **Recarga parcial · 36 PA** and **Faltan 6 PA de recarga**. Confirming fire with Enter advanced the reload, leaving zero AP and all 11 reserve cartridges. After the enemy turn and its control windows, turn 2 showed a 6 AP reload. R completed it: 100→94 AP, 11→10 reserve cartridges, and one loaded charge. The test tab remains on the ready soldier. This skirmish did not write to the campaign save.

All 1,268 tests, the type check and the production build pass in the isolated gameplay checkout. Partial loading via physical pointer clicks and live save loading remain covered indirectly by shared controls and automated checks. This feature does not implement artillery work across turns or separate weapon-readying AP.
