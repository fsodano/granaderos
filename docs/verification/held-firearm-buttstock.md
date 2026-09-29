# Held firearm melee uses the actual stock

Runtime/test source: `918277451e811988139e0f7b250cf48680f27e58`.

A selected firearm uses a short stock strike instead of an unowned bayonet.
The default profile costs 16 combat AP, has 18 base injury and 1.5-cell contact
reach. These are Granaderos tuning values. Existing movement momentum, parries,
ponchos, counterattacks, civilian consequences and wound rules still apply.
This is not a nonlethal attack or the separate punch breath-loss formula.

The stock does not add another weapon or mass, consume a loaded cartridge,
change loose reserves, repair a jam, discard partial loading or reset wear.
A stock cannot brace against a charge or execute a blade charge. Selecting an
actual secondary retains that weapon's own profile and ordinary switching cost.
Empty selected hands continue to use punches. Automatic actors can strike at
contact with a gun or resume loading at distance, without requesting a stock
charge which the engine will reject. Existing authored secondary selection is
retained; generalized legacy AI equipment choices remain separate.

## Verification scope

Complete regression passes **1209/1209**, zero failures or skips, in 284,322 ms.
The related melee, HUD, reload and empty-hand group passes **53/53**. Types,
production export (722 files, 632 asset references), 36 reference comparisons
and the documentation audit (261 requirements, 100 evidence records) pass.
Exact-head CI remains required before publication.

Five new simulations and one mounted production-game check cover all nine gun
families, loaded and jammed/partial mechanisms, exact AP, contact range, atomic
failures, actual secondary selection, empty hands, automatic actions and a real
paid campaign hire. The authored gun is used against a living enemy in declared
compact opening geometry, then saved, withdrawn and redeployed with its exact
weapon definition, image and secondary. The mounted flow clicks the normal
stock control and enemy figure and reads the normal persisted save.

The first complete run exposed fourteen stale assumptions or route failures.
Fixtures that need a blade death or interception now select or supply an actual
owned blade. Prepared crew shortages explicitly remove an available worker
instead of depending on a previous casualty. The routed-enemy boundary supplies
consistent consciousness. A legacy opening now uses the existing cover/fire
controller and preserves its real surviving Cabral instead of inventing a
bayonet. Actual costs, injuries and permanent losses are recorded again from
fresh routes. The historical campaign controller renews contracts against the
actual departure time after medical/daylight waits, paying the normal price.
None of these fixture corrections grant health, equipment, AP, victory or money.

## Remaining work

Loose owned bayonets retain the existing blade behavior. Physical gun fittings,
attachment/removal, equipment-dependent blunt accuracy and separate stock breath
impact are not accepted here. The default stock profile does not establish
historical numerical accuracy. These are simulations and mounted DOM checks;
no live-browser, frame-rate, all-seed balance or complete-game claim is made.

## Fresh campaign checkpoint

The checked historical route wins all thirteen localities at hour 558, second
459, with 8,168 pesos and squad 113/112/125/57/142. The commander has 59 HP;
no test restores his previous uninjured result. Deaths are
0/3/4/8/9/10/103/110/115/120/123/124/131/137/141/1000.
The coastal care step spends fourteen hours and thirteen purchased dressings
(130 pesos). No later stabilization is needed on this recorded route.

After 48 hours, a save and an ordinary field visit/return, the campaign remains
complete with thirteen controlled localities, 10,598 pesos, squad 125/57 and
commander 69 HP through normal recovery. Contracts 112/113/142 expire. Their
actors are absent from the scene and all recorded deaths remain permanent.
This is one reproducible simulation route, not general balance acceptance.
