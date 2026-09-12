# Hostile-sector entry

An attack order now deploys the squad in exploration. The presence of enemies elsewhere in the sector does not by itself start a turn. Sight is checked after terrain restoration, retained enemies, residents and boundary arrivals have their final positions.

A player sighting starts the player phase. If only the enemy sees the squad, the enemy receives first initiative. Movement stops at the step that establishes contact. Its earlier exploration steps use energy and time, with no AP charge. The movement log now also reports zero AP when the final step changes the mode to combat. The new combat budget reflects the soldier's current condition.

The campaign request keeps its original strategic purpose. An assault still produces a battle report, an ordinary visit still returns through the visit flow, and hidden living enemies are not removed or marked defeated. An exact resumed battle is not initialized again. The existing synchronized opening helper publishes any immediate enemy action with the matching campaign clock before autosave.

## Verification

Seven hostile-entry tests cover an ordinary assault, final resident positions, player-first and enemy-first initiative, retained hidden opponents and their equipment, movement stopped by contact, a saved fresh campaign before contact, and a loadable first save after immediate enemy initiative. The exploration step tests also cover changing light, wounds, collapse and atomic failures. The movement-at-contact case checks the zero-AP log.

All 1,491 repository tests pass. Type checks and the production build pass, with 278 exported files and 189 verified asset references. The standalone northern-route verifier also completes and reloads all exported checkpoints.

The reference route uses the original fresh seed 8, actual campaign orders and deterministic tactical replay. No soldier is resurrected and no battle result is synthesized. The changed contact rules alter the old recorded casualties. The revised route treats living patients with surviving doctors, makes real daylight approaches, pays renewals before departure, and hires replacements with their ordinary equipment.

| Stage | Actual result |
| --- | --- |
| San Nicolás | Victory, 14 turns, 149 tactical orders. Three soldiers die. |
| San Lorenzo | Victory, 7 turns, 107 tactical orders. One further death. |
| Opening recovery | Two surviving doctors use 18 dressings to treat the actual wounded reserves. |
| Córdoba | Victory, 11 turns, 83 tactical orders. The deployed squad returns uninjured. |
| Tucumán | Defeat, 5 turns, 63 tactical orders. Four die and two become prisoners. |
| Tucumán rescue | Victory, 4 turns, 84 tactical orders. Both prisoners retain their wounds and equipment; two dressings stabilize/treat them afterward. |
| Medical courier | Buys 30 dressings for 900 pesos. Recovery also uses 13 recovered and 7 donated dressings. |
| Salta | Two paid squads deploy ten soldiers. Victory in 5 turns and 137 orders; one further death. |
| Yatasto | The two remaining hemorrhages are stopped before departure. The mission completes at hour 217, second 1205, with 2,084 pesos. |

All nine deaths remain permanent. The standalone northern-route verifier exports and reloads every checkpoint, ending in phase 3 at Tucumán. A complete winning campaign beyond this route remains unverified.

## Live check

The production Battlefield preview uses the actual six-person San Nicolás deployment, including arrival fatigue and the real terrain. The campaign begins at hour 36, second 0. Inés starts at (43, 47), with 79 AP, 76 energy, one prepared charge and nine reserve cartridges.

With ambient time paused, successive three-step bounds reach (41, 44) at 13 seconds and (41, 41) at 22 seconds. AP remain 79; energy falls to 71 and then 68. The next bound establishes enemy-only contact at (41, 38). Enemy initiative brings both clocks to 37 seconds. The new combat budget is 77 AP at 65 energy; no cartridge has been spent. The journal reports zero AP for the approach. A crouch then spends the displayed 3 AP, leaving 74, without charging the already-started round again. Full campaign/battle save and load preserve the clocks, mode, position, energy and ammunition.

The preview can restart the deployment. Its separate local origin leaves the user's campaign save untouched.
