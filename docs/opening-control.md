# Opening campaign with turning AP

Verified 12 September 2026 against regional terrain and weather checkpoint `be30998`. The legal seed-8 route completes San Nicolás and San Lorenzo through ordinary combat and equipment orders. The longer northern route remains incomplete.

## Current equipment preparation

The old salvage plan required both a dead friendly rifleman and a paid replacement. All six original soldiers now survive San Nicolás, so that assumption stopped the route before San Lorenzo. Keeping their short guns then lost the second battle.

`tests/opening-equipment.mjs` now equips current short-gun holders from reachable, actual fallen combatants on either side. Surviving riflemen keep their equipment. Every recovered rifle retains its identity, fittings, condition and loaded ammunition; the replaced gun stays in its owner's pack. No missing source creates an item, forces a death or changes a battle result.

The current route wins both opening battles and repeats each battle to check determinism. The San Lorenzo inventory check selects an actual local survivor instead of requiring officer 1000 to survive. Four focused tests cover surviving rifle owners, finite enemy salvage, friendly remains, repeated preparation and missing supplies.

Northern preparation now takes the four carried dressings from the actual living donors, 110 and 114, and collects sixteen from the two battlefields. Three dressings heal the wounded survivor. It fills the six-person force with four real paid recruits, preserving every earlier death, and recovers available rifles and clothing. Córdoba falls through ordinary combat at hour 84; both combat runs produce the same outcome.

Paid Córdoba care now explicitly returns the newly hired doctor to reserve after normal hiring fills a vacant squad slot. It heals the surviving patient with fourteen dressings and ends at hour 104. Four paid relief soldiers make an exposed advance into Tucumán's citadel court, kneel and hold fire, while using real first aid on nearby bleeding allies. This deliberately poor tactic tests defeat and captivity. Enemy actions kill 131, 121 and 126; 124 is captured alive at one HP. The result replays deterministically and preserves actual equipment and deaths.

Rescue preparation hires and equips real reserves and brings two squads to Tucumán at hour 140. The current rescue strategy does not yet win: it reaches the turn limit with surviving opponents. The rescue, courier, paid recovery, Salta and Yatasto requirements remain unchanged and are not claimed complete. Dependent checks explain which earlier result is missing instead of reporting unrelated state errors.

## What failed and what changed

The previous reference driver spent each soldier's turn before allowing the next soldier to act. Its repeated reconnaissance orders could move one scout well ahead of the squad. It also bought extra aim after the displayed chance had reached its maximum. With the new turning costs, that strategy lost San Nicolás.

The driver now issues one order per soldier per pass, in its existing marksmanship order. It buys the least aim that gives the best currently affordable torso-shot chance. Target-specific AP costs, ordinary turn admission and saved interruption windows still govern every action.

This coordinated route won San Nicolás, then exposed a separate San Lorenzo deadlock. A nine-HP ally counted as active infantry support, so the remaining mission commander waited for a soldier who could not act. The commander could also alternate between standing to search and immediately returning prone. The driver now counts field-capable allies as support and requests the commander's firing posture only while enemies are visible.

`tests/opening-driver.mjs` holds the reference control logic. Four focused tests verify useful aim, exact turning/aim affordability, a commander standing then moving with only a critical ally, and the retained support/contact rules. `tests/opening-playthrough.test.mjs` retains its original campaign requirements and independently repeats each battle to verify deterministic outcomes.

The seed, recruits, purchased supplies, waits, casualty records, salvage transactions, save assertions and victory requirements are preserved. Production combat code is unchanged by this checkpoint. The original control strategy can still lose; the new reference establishes a legal winning route, not guaranteed victory or general balance.

## Earlier route at the turning-AP checkpoint

| Battle | Actual arrival | Turns | Orders | Outcome |
| --- | --- | ---: | ---: | --- |
| San Nicolás | Hour 36, second 0 | 10 | 122 | Victory |
| San Lorenzo | Hour 60, second 191 | 12 | 110 | Victory |

San Nicolás loses operatives 114, 123 and 107. Immediate aid stops all surviving hemorrhages. The route hires a relief doctor, transfers finite recovered dressings, provides paid/time-consuming care, moves low-morale survivors to reserve, hires replacements and salvages actual fallen riflemen's weapons. Stored replacement guns retain their loaded charges.

San Lorenzo loses 131, 137, 113, 124 and 117. The hired field survivor is the critical nine-HP medic 116; mission ally 57 survives at 20 HP. All eight operative deaths remain permanent through battle reports and synchronized saves. Earlier surviving operatives remain in reserve.

These heavy losses leave campaign balance and the longer campaign open. Completing two opening battles does not prove later attacks, sector defense, recovery from capture, or the campaign ending.

At that earlier checkpoint, the complete isolated regression suite passed **1,310/1,310 tests**, including both deterministic battle replays and the four driver checks. Those counts and the casualty table above are historical evidence, not the current regional-weather result.

The [northern-route checkpoint](northern-route.md) extends this same fresh opening through finite recovery and a real Córdoba victory. The full campaign remains unverified.
