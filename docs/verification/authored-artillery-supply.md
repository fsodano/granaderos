# Authored finite artillery replenishment

Runtime/test source: `27c689a9479529edb292aa25311eb8455a395ff5`.

The armory can buy one reserve round for an exact local friendly emplacement.
The quote and command require a controlled sector connected to headquarters,
no pending tactical scene, no capable retained hostile, an available local squad
member, room under the supply limit and sufficient pesos. Rejected orders retain
money, gun identity and custody. A completed campaign can still buy supplies;
a defeated campaign cannot.

Payment adds one reserve only. It does not load the piece, reset unfinished work,
change facing or position, create unissued stock or alter another gun. The crew
must use the ordinary tactical loading order. The local screen shows the owner,
load or unfinished percentage, reserve, price and precise rejection reason.
This uses the published pesos economy, not the older powder-and-iron ledger.

## Authoring

The story editor's **Reglas** includes artillery supply permission, one price for
each model and a reserve limit. Optional `artillerySupply` data pins all five
values to the campaign. Defaults are enabled, 20 pesos for a four-pounder round,
30 for an eight-pounder, 10 for a swivel, and six reserve rounds. These prices
and limits are explicit Granaderos tuning, not historical market-price claims.
Prices accept whole values from zero to 1,000,000 and the limit accepts 1–1,000.
Zero means free supply. Disabling the feature blocks replenishment purchases.

The limit only prevents further purchases when existing reserve reaches it.
It neither removes older ammunition nor changes the new-gun bundle of one loaded
shot and six reserves. The editor explains this distinction. Seven actual shots
and six reloads can exhaust that bundle without obtaining free rounds from
return/reentry. Old packages omit the new field and retain their content identity.
Reset, undo/redo, export/import, validation and campaign launch support the rules.

## Verification

Seven simulations, two mounted production-armory cases and one mounted editor
case exercise this delivery. The earlier artillery/loading/emplacement overlap
passes **28/28**; the two final armory cases pass **2/2**, and the editor case
passes **1/1**. Complete regression passes **1054/1054**, zero failures or skips
(244,503.746 ms), on the source above. Types and production export pass with
722 files and 632 asset references. All 36 reference comparisons pass. The
documentation audit passes with 240 requirements and 79 evidence records,
retaining all 50 original and 87 parity rows. Exact-head CI remains required
before publication.

The actual established-area combat fixture buys a cannon and wins San Nicolás,
then expends all seven shots through ordinary field actions. Buying one round
pays the quote, saves an unloaded piece with one reserve, reenters and loads it
through the real crew order. The mounted campaign performs that same purchase.
Repeated purchases stop at the pinned cap. A lower authored cap preserves all
six initial reserves and becomes available only after actual firing/reloading
reduces that supply below the cap.

Separate real paid/fired campaigns exercise an authored 37-peso price, free
supply and disabled replenishment. Prepared ownership, route, personnel, hostile,
funds and loading-work boundaries isolate eligibility and state preservation.
Prepared model changes verify all three price quotes; they do not establish a
fresh heavy-artillery combat route. A prepared 40-percent load verifies that the
actual armory shows retained work and preserves it while buying reserve.

The mounted editor changes every field, rejects an invalid limit, tests reset
and undo/redo, launches the pinned campaign, buys an actual gun and enters an
attack with full paired saves. Later draft edits do not change the launched
rules or the ordinary campaign save. The mounting checks are DOM tests, not
live-browser or loaded-performance acceptance.

## Remaining work

TAC-08, ITEM-02, STORY-06 and the overall integration remain partial. Individual
artillery transport/recovery, merchant trade, autonomous crews and editable gun
profiles remain separate. Supply uses the published controlled-road connection
policy; physical delivery convoys and distinct solid/canister stocks are not
introduced. The preserved [stationed artillery record](../gameplay/campaign/stationed-artillery.md)
describes a different, dated economy and acceptance checkpoint.

## Publication

Published in [PR #102](https://github.com/fsodano/granaderos/pull/102) on 2026-09-28.
Exact head `dd9a1841c509bb5960438946cacae8810470f287` passed [CI run 36491224484](https://github.com/fsodano/granaderos/actions/runs/36491224484), including the full suite, types and production build. Merge commit: `a44eaebf3d8155ef810f19f968fd3b77ef67be91`. This publication does not close the broader artillery or campaign requirements.
