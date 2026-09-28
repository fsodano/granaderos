# San Lorenzo settlement after post-victory exploration

Winning San Lorenzo exposed a state mismatch: **Explore the sector and recover
equipment** changes the tactical status from victory to active exploration. The
mission settlement required the old status and refused the ordinary return to
campaign, even though the field remained clear and the commander survived.

Settlement now accepts either the won battle or its cleared exploration state.
It also checks that a living unrouted player-side unit remains and no living
unrouted enemy contests the field. Unconscious enemies still contest it, matching
the tactical result rule. Missing clearance, active combat and defeat do not
qualify as post-victory exploration. A commander who dies after victory still
forces mission and campaign defeat.

Runtime source: `898b5574caf9482817381b35e0e799a0ade88eca`.
Merged through [PR #60](https://github.com/fsodano/granaderos/pull/60);
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36393328686/job/108833856001) passed.

## Verification

`tests/post-victory-mission.test.mjs` starts from explicitly prepared territorial
control and a compact final opponent. It wins through an actual melee attack,
enters exploration, treats the wounded commander with a finite dressing, walks to
and recovers the enemy weapon, saves and returns. Mission state, campaign phase,
commander health, supplies and recovered equipment persist. A repeated result
cannot pay or settle again.

Negative cases retain rejection of a contested field, missing clearance, combat
and defeated states. Routed enemies no longer contest an already cleared field.
A prepared fatal wound then advances through actual exploration time and keeps
the commander's permanent defeat outcome.

The mounted production page uses its normal victory, exploration and return
buttons, with an ordinary registered medical order in between. Its automatic save
contains the completed mission and treated commander. This is a mounted DOM test,
not a live-browser session.

Three new cases failed before the correction. The original late-commander-death
case already passed. All 24 focused mission, body, chapter and UI cases pass after
the fix.

Release checks: **790/790 tests**, zero failures or skips (188,630 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (198 requirements, all 50 original and 87 parity rows,
37 evidence records). Exact-head GitHub checks are required before merge.

## Limits

The prepared endpoint isolates settlement; it does not prove a fresh Retiro-to-
San-Lorenzo route or general combat balance. It does not redesign first aid,
mission authoring or general battle-report validation. The separate prototype
route failure and full historical/alternate campaign acceptance remain open.
