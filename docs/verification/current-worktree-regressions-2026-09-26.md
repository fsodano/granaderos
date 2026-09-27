# Current worktree regression audit — 2026-09-26

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](published-progress.md) for the main branch baseline.

A complete `npm test` run in the current worktree completed in 194.7 seconds:
2,775 tests, 2,751 passed, 24 failed. This is the current-tree result, not an
isolated-checkout result. The detailed local log is
`/tmp/granaderos-full-current-tests.log`.

## Corrected expectations and strengthened coverage

Eight failures reflected intentional runtime changes:

- Two campaign pocket tests and one disabled-inventory test expected 15 physical
  endpoints. The requested layout has 17: twelve pockets, two hands, three body
  slots. Campaign rendering now also asserts all three body slot IDs.
- The elevated light disclosure test expected the removed orange ellipse. It now
  checks the shared light-source component for visible roof lights and separately
  rejects it for hidden roof lights. Smoke disclosure remains checked.
- The early Buenos Aires patrol test expected six enemies; the first expansion
  now has four. Its 600-second movement/recovery and hidden-contact checks remain.
- Two public-report tests expected three enemies for every group. They now compare
  the observed count with the actual group's units, while retaining checks against
  leaking routes, private state or arrival schedules.
- The large-save fixture claimed 1,050 bodies but launched early-tier groups. It
  now explicitly represents twelve controlled sectors so the ordinary dispatcher
  creates thirty enemies per group. The 2 MB threshold, 1,050 bodies, thirty-five
  groups, round trips and existing size limits remain mandatory.

The aligned suite passed 43 tests. After strengthening the negative roof-light
assertion, its three tests passed again. New body-equipment coverage verifies
exact identity, condition and count for hats and trousers during transfer, drop,
recovery and corpse loot. These checks do not substitute for winning a campaign.

## Still open from the full run

Fourteen original failures remain unresolved after the opening-route follow-up below:

- `battle-integration.test.mjs`: controlled wet-weather victory ends in defeat.
- `campaign-web.test.mjs`: reinforced militia defense expectation.
- `fresh-campaign-recovery.test.mjs`, `opening-playthrough.test.mjs`,
  `prisoner-rescue-route.test.mjs`: route or recovery failures.
- `grenade-presentation.test.mjs`: two old SSR callback tests invoke orders
  without a mounted worker lifecycle; they assume synchronous movement and a
  removed turn timer. Their replacement must retain real presentation coverage.
- `stationed-artillery.test.mjs`: seven cases depend on winning route setup;
  several stop at an active battle and the rescue scenario loses.

The full suite has not been rerun after the eight corrections. There is no claim
that the current worktree, complete campaign route or loaded-scene 60 FPS gate is
passing. Do not reduce enemy counts, grant resources or accept a defeat merely to
make these remaining route checks green.

## Opening-route follow-up

Seventeen opening, capital-recovery, equipment-recovery and casualty-report
checks now pass (`/tmp/granaderos-capital-verified.log`). The first-expansion
test expects the actual four-enemy opening and preserves every participant's
injuries and equipment without requiring an otherwise avoidable death.

The weekly squad's former short approach loses. The ordinary rooftop approach
with the default 32-AP reconnaissance budget wins in eight turns, with permanent
losses of 114, 137 and 107. Recovery now hires a living replacement doctor,
recovers known finite dressings, buys the calculated shortfall at Retiro through
real travel, treats the actual survivors, and reuses those veterans and their
clothing. It forms two paid six-person squads without resurrecting the original
medic. Displaced guns are checked in their actual pack or ground location;
the route no longer requires a full pack when the surviving squad has room.

The full fresh-route test now passes Buenos Aires, recovery and San Nicolás,
then fails at support recruitment for San Lorenzo: insufficient funds for
operative 108's 63-peso weekly contract. This is a genuine remaining route
funding problem. No enemy counts, resources or victory assertions were changed
to accept the loss. The complete campaign and ending remain unverified.

## San Lorenzo follow-up

Mission preparation now reuses six conscious local veterans with active paid
contracts before considering new hires. The current support squad is 123, 115,
113, 110, 124 and 141; its additional hiring cost is zero. Integration assertions
verify unchanged contract records, unchanged treasury during support preparation,
six actual paid survivors, and immutable input state.

The full fresh-route rerun now wins San Lorenzo in 14 turns (131 orders), keeps
San Martín alive at 88 HP, and reaches phase 2 at hour 128 with 513 pesos. It
retains eight deaths from that battle. The battle helper also checks deterministic
replay and campaign save settlement. See `evidence/fresh-phase2-2026-09-26.json`.
The full test still fails later in northern medical recovery: the calculated
dressing requirement exceeds the single-purchase limit of twenty. A funded,
finite-supply recovery route is still required; neither the test nor the full
campaign is reported as complete.

## Northern recovery follow-up

The earned phase-2 checkpoint now completes paid recovery. The courier buys
affordable batches within the merchant's stock and twenty-item transaction
limit, then recalculates the remaining wounds before another trip. Deliveries
of twenty and six dressings cost 600 and 180 pesos. They consume normal travel
time; no supplies or funds are granted.

Care participants now renew expiring contracts through the normal paid dispatcher
before long trips, during care, and while resting for departure. This prevents
an expired contract from silently removing a wounded patient or doctor from the
care assignments. All four wounded survivors reach their actual maximum HP and
remain recruited with active contracts at departure. See
`evidence/fresh-phase2-recovery-2026-09-26.json` for costs and renewals.

The full fresh-route rerun passes the new recovery and contract assertions, then
fails at Córdoba: the twelve-person assault retreats after nine turns. The
required victory assertion remains unchanged. The complete campaign, ending,
art and full loaded-scene frame-rate acceptance remain open.

## Supplied Córdoba follow-up

The retreat exposed incomplete route preparation: three recovered veterans
still had dropped firearms, and two new support soldiers had no compatible
ammunition. Northern preparation now recovers actual long guns from both the
San Nicolás and San Lorenzo inventory sites for unarmed survivors as well as
replacement hires. Córdoba preparation produces missing ammunition through the
Retiro workshop, waits for completion, renews contracts before travel and reloads
both squads. Every deployed soldier must have a firearm, a loaded charge and
compatible reserve ammunition.

The full fresh-route rerun now wins Córdoba in fifteen turns and 183 orders,
retaining one permanent death (123), with 446 pesos at hour 335. Deterministic
replay and save settlement pass. See
`evidence/fresh-cordoba-supplied-2026-09-26.json`.

The next failure is the old recovery helper's demand for wounded routed survivors
in Buenos Aires. The current victory has none there; its actual wounded survivor
is in Córdoba. Recovery and subsequent defense preparation must follow those
real locations instead of requiring the earlier route's retreat pattern. Full
campaign acceptance remains open.

## Local recovery and Córdoba defense follow-up

When there are no routed patients in Buenos Aires, recovery now treats the actual
local wounded with an available, paid physician. In this run, physician 116 uses
recovered Córdoba dressings to heal 122 from 15 to 65 HP over ten normal campaign
hours. Patients and doctors retain their contracts; saved health is checked.

Defense preparation now waits for the scheduled strategic force instead of
assuming it has arrived during a longer, obsolete retreat route. The real
eleven-enemy counterattack reaches Córdoba at hour 438. The defense wins in five
turns and 139 orders; new deaths 120, 111 and 126 remain permanent. Replay and save
settlement pass. See `evidence/fresh-cordoba-local-defense-2026-09-26.json`.

The full fresh-route run (92.6 seconds) passes the local recovery, Córdoba defense,
Tucumán victory, hospital recovery and northern reunion assertions. It next fails
before Salta with `Debes abrir una ruta hasta el frente.` Current ownership and
enemy movement must be checked before planning that march. The full test remains
failing, and the campaign ending remains unverified.

## Northern supply-road follow-up

The Salta route failure was reproduced from the earned Córdoba-defense checkpoint.
Tucumán is supplied at reunion, but a thirteen-enemy interior raid captures
undefended Córdoba while the northern column rests. The supply-route restriction
is correct; it has not been removed.

Reunion now hires a six-person rear guard through ordinary weekly contracts,
equips it from finite recovered guns, and holds the road for a day. A five-person
holding force alone lost. With the paid guard, the actual hour-582 defense wins
in fourteen turns and 224 orders. Five new deaths remain permanent, including
officer 4. At reunion hour 600, Córdoba remains patriot and Tucumán is supplied;
1,562 pesos remain. See `evidence/fresh-northern-road-defense-2026-09-26.json`.

The coordinated Salta march is now legal. Its battle still retreats. Several
veterans have very low morale and some guns are not loaded at departure. The
route needs further preparation; no victory, full campaign completion or balance
acceptance is claimed from the road-defense fix.

The complete fresh-route test was rerun from a new game and reaches this same
Salta retreat (`/tmp/granaderos-fresh-road-guard.log`). Earlier route and road
defense assertions pass; the required Salta victory assertion still fails.

## Supplied Salta and living envoy follow-up

Salta preparation now fills the three existing squad vacancies with living paid
recruits 100, 119 and 130, equips from finite local stock, and finishes reloading
both squads through ordinary tactical orders. Every deployed soldier must have
a loaded firearm and compatible reserves. Loading alone still retreated; adding
the affordable reinforcements wins in thirty-four turns and 329 orders. Only
146, 1000 and 134 survive the twelve-person assault. Their losses are not reset.
The campaign retains 1,693 pesos at hour 620. Replay and save settlement pass;
see `evidence/fresh-salta-reinforced-2026-09-26.json`.

The fresh-game rerun passes the Salta victory and then exposed the fixed envoy
ID 1, who died in that battle. Northern handover now selects a living local envoy
by leadership. Operative 146 recruits through the real dialogue path, travels
to Yatasto and completes its conversations and saved mission. The checkpoint
reaches phase 3 at hour 635 with 2,121 pesos; original envoy 1 stays dead. See
`evidence/fresh-yatasto-living-envoy-2026-09-26.json`. Full Cuyo, final ending,
visual and performance acceptance remain open.

The fresh-game rerun reaches completed Yatasto, then fails an outdated assertion
that classified Azurduy's earlier Salta death as a new handover loss. The assertion
now preserves prior deaths and requires battle evidence only for new handover
deaths. The saved Salta/Yatasto checkpoints pass the revised survivor and mission
assertions. The full route has not been rerun after this assertion-only correction;
Cuyo still needs verification with the current survivors.

## Living Cuyo preparation follow-up

Cuyo preparation now handles the actual Salta encounter before issuing further
orders, using its offered retreat to Tucumán and preserving the selected assembly
squad. Medical budgeting selects living wounded participants and an available
local physician; it no longer tries to heal dead operative 1. Supplies use normal
paid transactions of at most twenty. Pre-defense health checks apply to the actual
assembled squad; later battle wounds are not expected to disappear.

The full fresh-game rerun passes Yatasto and Cuyo preparation, then fails at the
required Mendoza victory. Preparation reaches Córdoba at hour 646 with 557 pesos,
a paid day contract for 142 and a healthy six-person field squad. Dead operative 1
remains dead. See `evidence/fresh-cuyo-living-preparation-2026-09-26.json`.

Mendoza has thirteen defenders. Three veterans enter with morale of 3, 3 and 5.
The existing approach loses; a covered rooftop approach retreats, and a separate
paid-swivel trial also loses. Those trials did not alter runtime rules or the
committed route expectation. Combat readiness, the Mendoza victory and all later
campaign completion remain open (`/tmp/granaderos-fresh-cuyo-preparation.log`).

## Worker message failure recovery

The shared battle executor now rejects pending orders on `messageerror`, as it
already did on a worker execution error. Previously a message decode failure
could leave movement or turn processing waiting indefinitely. The existing
main-game executor hook can now receive the rejection and apply its normal
fallback. Worker shutdown is idempotent; late messages cannot resolve old orders.

Eight focused worker and main-campaign integration tests pass. The new failure
checks cover multiple pending orders, both browser error events, late replies,
repeated errors, new orders after failure, and repeated cleanup. They do not
simulate a browser decode failure in the live game or establish FPS acceptance.

The grenade presentation suite was also rerun: eight pass and two fail. Its
movement case assumes synchronous completion, and its turn case expects the
removed 450 ms timer during server rendering. Both need mounted asynchronous
component coverage; they were not weakened or marked as passing. Full campaign
completion and the Mendoza route remain open.

## Mounted grenade and movement checks

Replaced the two obsolete server-render timing checks with mounted React
controller checks using jsdom (a development-only dependency). These run the
actual battlefield hooks and equipment provider, with worker delivery held
until explicitly released. Worker jobs use the normal battle reducer. Child
scene graphics retain their separate rendering tests; this is not a browser
frame-rate measurement.

The checks verify that no battle is published before the worker reply, duplicate
movement input is ignored while pending, moving keeps the held grenade, and an
enemy grenade effect is shown only after campaign acceptance. A message-decode
failure also exercises the real hook fallback and completes the original move.
Both old failures are resolved without reinstating the removed timer or changing
game rules. The combined grenade, worker and main-campaign checks pass: 20 tests.

Full current-worktree rerun after this change: 2,794 tests, 2,776 passed, 13 failed,
5 skipped, no cancellations (195.5 seconds). Log:
`/tmp/granaderos-full-mounted-current.log`. Type checking and production export
also pass (961 files, 857 asset references).

Remaining failing areas are the wet-weather settlement victory, reinforced
militia defense, fresh-route Mendoza victory, the established opening recovery
ammunition expectation (with its parent suite failure and five skipped later
steps), prisoner rescue, and seven stationed-artillery cases. The latter still
fail their prerequisite victory. This replaces the earlier 24-failure snapshot;
it is not a full-suite pass or campaign-completion claim.

## Stationed artillery preparation follow-up

The common legacy artillery setup previously entered San Nicolás at 52 energy
and used an infantry controller that left the cannon at its arrival position.
It now rests through ordinary assignment/wait orders between marches, then
coordinates the gun crew and an infantry screen. The final march still charges
its actual time and fatigue (76 energy on arrival). No enemy strength, HP,
ammunition or combat rules were changed.

The resulting battle wins at turn 26 after 160 orders. Operative 10 dies and
remains dead; the cannon moves from (43,46) to (41,41) through normal orders.
The suite passes 13 of 14 tests in 151.5 seconds, restoring six previously blocked
ownership, firing, resupply, placement and save checks. The prisoner/cannon rescue
still loses its real battle and remains failing. See
`evidence/stationed-artillery-preparation-2026-09-26.json` and
`/tmp/granaderos-artillery-rested-tests.log`. The full suite was not rerun after
this focused test-route change; no full-game completion is claimed.

## Paid cannon and prisoner rescue follow-up

The remaining artillery rescue now hires six available rescuers for 889 pesos,
issues the depot's three remaining ponchos, and rests between the real marches.
The covered approach wins in thirteen turns and 182 orders. Guards retain their
actual health and supplies; no battle outcome or casualty is assigned manually.
Original dead soldiers 3 and 4 remain dead. Rescuers 131 and 124 also die.

The focused rescue test passes, including actual custody care, release of prisoner
10, retained wounds and clothing, the recovered cannon's identity/load/position,
and save/reload settlement. Log: `/tmp/granaderos-artillery-rescue-verified.log`.
See `evidence/stationed-artillery-rescue-2026-09-26.json`. The other thirteen
artillery cases passed in the preceding run; the complete suite has not been
rerun after this rescue-only preparation change. Fresh-campaign completion and
the separate Humahuaca evacuation route remain open.

## Humahuaca evacuation investigation

The established-front rescue currently deploys six paid soldiers against eleven
guards. All arrive at 64 energy. A covered approach and a clear-guards-first
approach both lose. Rest before the march does not change arrival energy because
the soldiers are already rested; the journey itself consumes energy. The tested
northern firing controller also loses (turn 8, one guard killed, no departures).
A separate attempt to issue ponchos stops at the normal finite-stock rejection.

No experimental controller or condition change was adopted. The route still
requires release and physical evacuation of all three prisoners, and is not a
successful rescue. Further preparation must use actual equipment purchases or
coordinated reinforcements. See
`evidence/humahuaca-rescue-investigation-2026-09-26.json`. The fixed casualty
expectations in the old test will also need comparison with the actual successful
battle once one is achieved; no assertion was relaxed during this investigation.

Paid preparation follow-up: two imported Baker rifles, delivered through the
normal shipment clock and equipped by 112 and 113, let the northern controller
clear all eleven guards and evacuate five rescuers. This is still a failed
rescue: a missed friendly shot inflicted 61 damage on prisoner 10, who then died
from bleeding. A firing-line avoidance trial kept all three prisoners alive but
ended in morale retreat with no physical departures. Neither trial was adopted.

The route helper now explicitly requires every original prisoner to leave alive
through the Jujuy exit, plus an actual saved departure. A generic retreat outcome
cannot establish rescue success. The unchanged baseline battle still fails; a
paid coordinated support squad is the next preparation step. Evidence and logs:
`evidence/humahuaca-paid-relief-2026-09-26.json`.

## Immediate / queued mountain-assault parity

The coordinated rescue investigation exposed a runtime discrepancy: immediate
assaults always marched for twelve hours, but queued assaults use the shared
terrain-aware travel rule (eighteen hours for Jujuy to Humahuaca). The immediate
test route therefore arrived with 64 energy while the queued route arrived with
46. Rest before departure could not remove this difference.

Immediate assaults now use `travelLegHours` for both campaign time and mount
travel. Plain-ground assaults retain twelve hours. A new comparison test first
failed with 12 versus 18, then passed after the fix. It checks independent
dispatches, identical elapsed time, energy, fatigue, health, and tactical issue
state, without mutating the initial campaign. The combined travel, fatigue and
coordinated-assault suite passes 25 tests. Logs:
`/tmp/granaderos-assault-parity-before.log` and
`/tmp/granaderos-assault-parity-after.log`.

This correction makes the immediate mountain route harder; prior direct-assault
checkpoints do not prove acceptance under the corrected timing. Queued assaults
are unchanged. The proposed twelve-person Humahuaca support force was correctly
rejected because only eight arrival cells are open. An eight-person paid force
fit but still lost; all three prisoners remained alive. The rescue remains open,
and neither experimental support fixture nor firing controller was adopted.

## Shared immediate-assault journey

Expanded parity checks reproduced five more discrepancies: immediate assaults
ignored posta, carts and flotilla selections and always charged a foot march.
Immediate assaults now create and advance the same squad journey as queued
assaults. Transport eligibility, remount spending, terrain duration, fatigue and
arrival all use the shared implementation. An interrupted advance stays pending
instead of assigning an arrival that has not occurred.

All 36 focused tests pass (travel-mode parity, invalid transport / remount /
sleeping-soldier rejection, coordinated assaults, fatigue and main-campaign
integration). Type checking and production export pass. Logs:
`/tmp/granaderos-transport-parity-before.log`,
`/tmp/granaderos-transport-parity-final.log`, and
`/tmp/granaderos-transport-parity-build.log`. No full-suite pass is claimed.

A separate paid posta rescue trial correctly arrived with 88 energy for all
eight soldiers, but still lost at turn six without evacuating anyone. All three
prisoners remained alive. This narrows that trial's remaining issue to combat
approach under the prisoner-safe firing constraint, rather than arrival fatigue.
The experimental fixture remains outside the accepted route.

## Full shared-travel regression snapshot

After immediate assaults were moved onto the shared journey implementation,
the full suite ran to completion: 2,806 tests, 2,794 passed, 7 failed, 5 skipped,
no cancellations, 215.8 seconds. All stationed-artillery tests pass in this run.
Log: `/tmp/granaderos-full-shared-travel.log`.

Remaining failures cover wet-weather victory, reinforced militia defense,
scripted campaign recovery before another march, fresh-campaign Mendoza,
the established opening's fixed ammunition-production expectation (and its
parent suite), and Humahuaca rescue. The scripted campaign now fails when it
tries to march with soldiers who cannot yet wake after an intervening encounter;
that helper must complete real recovery instead of bypassing the shared rule.

The established opening no longer demands a fixed sixty-round Baker production
job. Its expectation is derived from the actual staged survivors' weapons,
loaded charges, compatible reserve rounds and typed depot stock. Jobs must still
match the real recipe yield/cost and complete before departure; the preparation
helper checks actual resource deductions.

The focused established-route rerun passes its first three subtests: San Lorenzo
medical recovery, paid Córdoba capture, and Tucumán defeat with permanent losses
and captivity. It then fails because `prepareRescueSquad` assumes the pending
encounter is Buenos Aires, while the actual encounter is Córdoba. Three later
subtests remain skipped. Log: `/tmp/granaderos-opening-actual-ammo.log` (24.2 s).
This is further route coverage, not complete northern-campaign acceptance.

The rescue helper now handles a pending Buenos Aires encounter only when that
is its actual sector, and invokes the existing Córdoba defense path before
attempting local purchases. The focused route retains its first three passing
subtests, then loses the actual Córdoba defense. The previous location assertion
is resolved; the required victory remains failing.

Two separate temporary trials hired four paid escorts before the medical reserve
marched. Both the normal and covered approaches retreated. Those experimental
hiring/controller changes were not adopted. Logs:
`/tmp/granaderos-opening-current-encounter.log`,
`/tmp/granaderos-opening-escorted.log`, and
`/tmp/granaderos-opening-escorted-covered.log`. No casualties, resources, enemy
counts or victory requirements were changed to make this route pass.

## Interrupted recovery in scripted campaign progression

The scripted production-and-liberation driver now rechecks recovery after each
strategic contact that interrupts sleep. It uses ordinary sleep/wait orders and
does not submit another march until that recovery returns without a pending
encounter. Existing scripted battle reports remain explicit subsystem fixtures;
they are not evidence of tactical victories.

The full production-and-liberation case now passes in 172 seconds, retaining its
resource, production, phase and ending assertions. Log:
`/tmp/granaderos-scripted-recovery.log`. This resolves the progression helper's
post-encounter sleep failure. The full worktree suite was not rerun after this
focused correction. Fresh-game combat completion remains unverified.

The top of `docs/verification/gameplay-completion.md` now identifies current acceptance evidence
and labels the older 22 September checkpoint claims as superseded, so historical
Mendoza and ending progress cannot be mistaken for current completion.
