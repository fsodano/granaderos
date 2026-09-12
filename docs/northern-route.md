# Campaign verification through Córdoba

Verified 12 September 2026, starting from a fresh seed-8 campaign. This extends the [opening checkpoint](opening-control.md) under the current turning, finite-supply and weapon-fitting rules. It proves one legal route through Córdoba, not the complete campaign or general balance.

| Battle | Turns | Tactical orders | Result |
| --- | ---: | ---: | --- |
| San Nicolás | 10 | 122 | Victory |
| San Lorenzo | 12 | 110 | Victory |
| Córdoba | 8 | 99 | Victory |

Every battle uses the ordinary tactical reducer and repeats with an identical result. Campaign time is synchronized before actual battle reports are accepted. Save encoding and decoding preserve each checkpoint. The original opening actions and assertions now live in `tests/opening-campaign.mjs`; the opening test uses that same scenario and adds the northern recovery and battle as a subtest.

## Recovery and march

The opening leaves eight permanent operative deaths, a nine-HP field medic, and three earlier survivors in reserve. The continuation hires doctor 112 for a prepaid week and collects twelve discovered, reachable dressings from the actual San Nicolás equipment pool. The source loses exactly twelve dressings, and treatment consumes all twelve. Patients 110 and 116 recover to full health over twelve hours. Six further hours of rest restore the doctor's energy. Morale remains low: 17.4 and 3 for the two patients.

At hour 78, the route buys day contracts for operatives 128, 142 and 105. The six-person field squad is 1000, 115, 112, 128, 142 and 105. The recovered patients stay behind. The real twelve-hour march reaches Córdoba at hour 90, second 263.

Córdoba falls at hour 90, second 311. All six field operatives survive, but doctor 112 has only 13 HP. Treasury is 1,992 pesos after ordinary costs, income and rewards. The three day contracts expire at hour 102. These constraints must be resolved through actual care and contract actions before extending the route; the verifier does not restore health, morale, supplies or contracts by direct state changes. All eight opening deaths remain permanent.

## Reproduce and inspect

Run from the repository root:

```sh
node tools/verify-northern-route.mjs --output /tmp/granaderos-northern-route-check
```

The tool starts a fresh campaign and writes `opening.save.json`, `prepared.save.json`, `cordoba.save.json`, and `report.json`. Each save is read back and validated against the actual campaign state. The report records recovery orders, timing, battle results and remaining personnel. Without `--output`, the tool creates a new temporary directory. It does not access browser storage or change the player's campaign.

The isolated full suite passed **1,311/1,311 tests**, and a separate command-line run completed the entire route and wrote all three validated saves. This checkpoint changes verification tools and documentation only; runtime code is unchanged.

## Remaining evidence gaps

The full campaign, defenses, capture recovery and ending remain unverified through real tactical outcomes. Older late-campaign tests that inject victory reports do not supply that evidence.

This run also exposed an equipment access gap. San Lorenzo has a saved mission snapshot and discovered equipment, but no campaign sector of its own. The strategic inventory requires a controlled campaign sector and rejects that mission snapshot; selecting San Nicolás shows only its separate equipment pool. The opening leaves 29 known rows at San Lorenzo, including two dressings, without a strategic pickup path. This checkpoint records the gap without claiming to fix it.
