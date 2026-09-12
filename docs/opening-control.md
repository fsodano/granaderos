# Opening campaign with turning AP

Verified 12 September 2026. The legal seed-8 campaign again completes San Nicolás and San Lorenzo with the target-specific turning costs introduced in `88e34f5`.

## What failed and what changed

The previous reference driver spent each soldier's turn before allowing the next soldier to act. Its repeated reconnaissance orders could move one scout well ahead of the squad. It also bought extra aim after the displayed chance had reached its maximum. With the new turning costs, that strategy lost San Nicolás.

The driver now issues one order per soldier per pass, in its existing marksmanship order. It buys the least aim that gives the best currently affordable torso-shot chance. Target-specific AP costs, ordinary turn admission and saved interruption windows still govern every action.

This coordinated route won San Nicolás, then exposed a separate San Lorenzo deadlock. A nine-HP ally counted as active infantry support, so the remaining mission commander waited for a soldier who could not act. The commander could also alternate between standing to search and immediately returning prone. The driver now counts field-capable allies as support and requests the commander's firing posture only while enemies are visible.

`tests/opening-driver.mjs` holds the reference control logic. Four focused tests verify useful aim, exact turning/aim affordability, a commander standing then moving with only a critical ally, and the retained support/contact rules. `tests/opening-playthrough.test.mjs` retains its original campaign requirements and independently repeats each battle to verify deterministic outcomes.

The seed, recruits, purchased supplies, waits, casualty records, salvage transactions, save assertions and victory requirements are preserved. Production combat code is unchanged by this checkpoint. The original control strategy can still lose; the new reference establishes a legal winning route, not guaranteed victory or general balance.

## Current route

| Battle | Actual arrival | Turns | Orders | Outcome |
| --- | --- | ---: | ---: | --- |
| San Nicolás | Hour 36, second 0 | 10 | 122 | Victory |
| San Lorenzo | Hour 60, second 191 | 12 | 110 | Victory |

San Nicolás loses operatives 114, 123 and 107. Immediate aid stops all surviving hemorrhages. The route hires a relief doctor, transfers finite recovered dressings, provides paid/time-consuming care, moves low-morale survivors to reserve, hires replacements and salvages actual fallen riflemen's weapons. Stored replacement guns retain their loaded charges.

San Lorenzo loses 131, 137, 113, 124 and 117. The hired field survivor is the critical nine-HP medic 116; mission ally 57 survives at 20 HP. All eight operative deaths remain permanent through battle reports and synchronized saves. Earlier surviving operatives remain in reserve.

These heavy losses leave campaign balance and the longer campaign open. Completing two opening battles does not prove later attacks, sector defense, recovery from capture, or the campaign ending.

The complete isolated regression suite passed **1,310/1,310 tests**, including both deterministic battle replays and the four driver checks. Whitespace validation passed. This change contains test-driver and documentation files only; the prior production type check, build and live shot-cost verification remain applicable to the unchanged runtime code.
