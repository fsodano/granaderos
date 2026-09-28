# Stationed artillery and finite issue

Runtime/test source: `75b6409fa12ade7c00f1ea0207e421f59245f579`.

An attack removes each selected new cannon from unissued armory stock once and
gives it a campaign identity. The purchase includes one loaded shot and six
reserve rounds on this first issue only. The piece remains in the attacked
sector with its actual model, full-map coordinates, facing, load and finite
reserve. Returning and revisiting cannot recreate stock or refill ammunition.
An explicit empty battery leaves resident guns in place and issues no new guns.

Victory captures the physical pieces. Withdrawal or defeat leaves them with
surviving enemy occupants; a later real victory recaptures the same records.
Royalist strategic control applies to resident pieces on the next entry. New
paid pieces join retained guns at distinct clear exterior cells. Yatasto uses
its separate scene and does not copy the artillery of Tucumán.

Pending deployment receipts, tactical reports and full saves reject missing,
duplicated, changed or refilled pieces. Stored scene identities cannot occur in
two places. Active pending records may refer to their same prior emplacement,
with matching model, owner, coordinates and initial ammunition. The active
battle may spend shots and move the piece through ordinary crew orders.
Friendly stationed pieces count toward the historical army's three-gun
requirement. Unissued stock remains separate from deployed ownership.

The actual armory screen lists local emplacements, their owner, loaded state
and reserves. Battery slots list only stock available for the next attack.
Stationed pieces remain where they were left. Strategic recovery, transport,
resupply and trade are separate work; this delivery does not introduce the
preserved development version's powder-and-iron economy.

## Old saves

Older saves reused a stock projection in multiple historical scenes. Migration
allocates that paid stock once: an active battery takes priority, then retained
scenes in descending saved time. Historical copies beyond available stock are
removed. The most recent allocated piece retains its observed load and position.
Active legacy identities remain unchanged so the paired tactical save still
matches. New pieces use a monotonic campaign identity. Migration is idempotent.
This policy prevents converting old projections into additional purchased guns;
it cannot reconstruct movements that the previous format never recorded.

## Verification

Ten new simulations and one mounted production-game case exercise this delivery.
The earlier overlapping artillery/selection group passes **22/22**. The final
scene group passes **14/14**, including the separate Yatasto boundary. Complete
regression passes **1032/1032**, zero failures or skips (240,898.493 ms), on the
source above. Types and production export pass with 722 files and 632 asset
references. All 36 reference comparisons pass. Documentation validation passes
with 238 requirements and 77 evidence records, retaining all 50 original and
87 parity rows. Exact-head CI remains required before publication.

The authored established-area fixture starts with Buenos Aires controlled and
10,000 pesos, pays six ordinary week contracts with immediate authored arrivals
and buys its swivel for 400 pesos. An ordinary six-hour wait and travel put the
assault in daylight. The conservative acceptance controller wins actual San
Nicolás combat using legal orders. Two hired soldiers die and remain dead. No
health, supplies or battle outcomes are replaced. The earlier aggressive
controller lost this assault; its result was not relabelled as a victory.

The return sequence fires an actual shot, synchronizes the campaign clock and
round-trips full saves and repeated visits. A real reload consumes one reserve
round. A separate actual withdrawal and subsequent real victory verify capture
and recapture of the identical piece. A second actual paid cannon joins the
occupied field without overlap. Corrupt report/save tests and declared legacy
copies verify rejection and migration boundaries.

A prepared northern story boundary reuses the actual fired and returned piece
to test conference separation; it does not establish a northern conquest route.
The mounted production campaign returns from the actual fired visit, displays
the unloaded emplacement and six reserves, saves an empty battery choice and
reenters with the same piece. This is a mounted DOM test, not live-browser or
loaded-battle performance acceptance.

## Remaining work

TAC-08, ITEM-02 and the overall integration remain partial. Individual crew
loading across turns, exploration work timing, autonomous artillery decisions,
strategic recovery/transport, finite resupply, sale and editable artillery rules
remain separate. Preserved development records describe larger, dated systems:
[stationed artillery](../gameplay/campaign/stationed-artillery.md),
[transport](../gameplay/campaign/artillery-transport.md) and
[crew loading](../gameplay/equipment/artillery-reload-progress.md).
