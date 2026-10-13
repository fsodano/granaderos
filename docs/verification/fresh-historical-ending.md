# Fresh historical victory and saved continuation

**Current status — 12 October 2026:** The completion figures and methods below
describe the dated September source. Read the [shipping campaign status](../plans/core-campaign-v0.1.md)
for current checks. Merged PR #401 proves an earned twelve-person capital
victory; PR #407 proves an earned paid northern reunion, and PR #410 proves
finite recapture care and the living cohort's return. PR #411 proves the
earned Salta movement continuation; PR #412 retains serving returnees in
capital relief regardless of their province; PR #413 proves the earned
northern party's corrected Yatasto handover. These separate
receipts do not prove either complete fresh ending, its 48-hour continuation
or release acceptance. The complete original recovery on `2603c3e6`
passes the actual Salta and Yatasto gates, then fails the preserved return-party
assertion at line 170. A separate handover diagnostic identifies living Juana
remaining in Salta instead of joining the return party. The
mission completes; PR #413 corrects that earned party, while the complete
unchanged original rerun on `a68dd0dc` finishes 0/1. Its actual Salta,
Yatasto and living-officer participation assertions pass, then line 174
stops on the lack of a reachable finite dressing for actor 10 at Córdoba.
That finite-source and ordinary-care diagnosis remains open.
The current status record preserves this failure and the earlier receipts.
Linux campaign quick passes 125/125 files and 428/428 tests on `2603c3e6`,
then separately passes 125/125 files and 429/429 tests on `8d777d51`, and
126/126 files and 431/431 tests on `a68dd0dc`. Complete Linux core quick
passes 912/912 files and 7,123/7,123 tests on `2603c3e6`, including all four
portable PNG controls. The newer `a68dd0dc` workflow and duplicate core job
are cancelled only after its successful campaign report and log are saved;
the completed campaign job remains successful. Cancellation is not a
passing `a68dd0dc` complete core result. Both fresh endings, saved 48-hour
continuation and full-release acceptance remain open.
Earlier ordinary-start checkpoints retain their separate [stock campaign evidence](stock-campaign-route-2026-10-04.md).
Separate 32,000-peso funded fixtures do not establish ordinary-start acceptance.

The [persistent ammunition record](strategic-ammunition-custody.md) contains
the later route checkpoints, actual costs and surviving force. The original
source and dated results below remain historical evidence.

Later partial-loading integration changes the route tactics, costs and casualties.
See [the partial-loading record](partial-firearm-reloads.md) for that source and
its new checkpoints; the results below retain their original source.

One untouched published stock campaign now completes all thirteen strategic
localities with actual combat, paid service and permanent losses. It starts in
Retiro with default content, seed 8 and 3,200 pesos. The created officer dies during
the northern route; the remaining force continues through Cuyo and wins the final
campaign with San Martín alive.

Source: `61d7130e2e2f9c78ad163b560765d29d9275d7a4`.

Later manual-care integration changed the reproducible route costs and casualties.
See [the finite first-aid regression record](finite-first-aid.md) for that source;
the checkpoint below remains evidence of this earlier release.

[Recorded checkpoints](../evidence/fresh-historical-ending-2026-09-28.json).
The complete test includes the accepted [coastal](fresh-coastal-opening.md),
[northern](fresh-northern-opening.md) and [Cuyo](fresh-cuyo-preparation.md) prefixes.

## Method and acceptance

`tests/fresh-ending-route.test.mjs` executes the full route from a new campaign.
No starting checkpoint, resources, health, territory, personnel or battle result
is injected. All fights use ordinary actions against visible targets, with finite
ammunition and care. Each final battle is replayed with campaign time, a midpoint
save and comparison of final troops, civilians, random state and elapsed time.
The final tactical victory does not finish the campaign until its result settles.

After Cuyo, the force renews expiring contracts, pays for supplies and a musket for
its commander, and fights at Santa Fe and Ensenada. It preserves the deaths of
Soria and Delatour. Before the last northern offensive, it visits the Córdoba
workshop, travels to controlled Salta and waits for ordinary territorial income.
Blackwood and Reed are hired for paid daily terms and physically arrive after
six hours. Reed dies in Jujuy. The remaining daily contract is paid again before
its next approach. The survivors then win Humahuaca.

Saved victory requires all thirteen localities controlled, no blockade, the
prepared/funded army, the incorporated living commander, and no pending battle.
Actual mission/project gates are exercised in the complete prefixes. The final
state has phase 4, hour 414, 2,931 pesos and five current squad members. San Martín
has 88 HP. The original officer and all other casualties remain dead.

The test then advances 48 real campaign hours. Ordinary income arrives, Blackwood's
contract expires, and the victory remains saved. A sector re-entry does not put
the expired hired character back on the map. The squad leaves normally; the ending
is not repeated, dead characters stay dead and the army cannot be funded twice.

Release checks: **800/800 tests**, zero failures or skips (195,002 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (203 requirements, all 50 original and 87 parity rows,
42 evidence records). [PR #65](https://github.com/fsodano/granaderos/pull/65) merged
after [GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36411691221/job/108893140167)
passed at `c45127b32c074346ca8e085545dc69dfe1d9629d`.

Victory is recorded at hour 414, second 485, with eighteen permanent deaths. The
post-victory visit leaves hour 462, second 485, 5,361 pesos and four active squad
members, with all thirteen localities still controlled.

## Limits

This accepts one mixed-force strategy and stock seed under the published rules.
It is not a guarantee for every force, a solo/unpaid route or the hired-only full
campaign. The advanced local medical, prisoner rescue, recapture and performance
requirements remain separate and incomplete. An independently authored full
campaign is also still required. Simulation, replay and save checks do not establish
live-browser usability or sustained frame rate. This delivery changes verification
only; it does not weaken enemies, grant resources or alter gameplay difficulty.
