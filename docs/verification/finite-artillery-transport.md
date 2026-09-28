# Finite artillery transport and local depots

Runtime/test source: `ffa7c8e05fa537ec9cf888f88bcf6b081db45872`.

A friendly gun in a cleared, controlled named locality can travel by an organized
cart or flotilla route. The active squad must be there and provide the authored
number of capable crew members. Captives, critical casualties, personnel in
medical care or training, a pending tactical scene and campaign defeat prevent
dispatch. The armory shows the destination, transport, duration, crew requirement
and the same rejection reason that execution uses.

Dispatch removes one actual emplacement. Its exact identity, model, side, facing,
loaded charge, reserve rounds and unfinished loading move into one shipment.
Arrival moves that record once into the destination depot. Visiting the depot
does not place the gun automatically. The battery controls select the exact local
record for the next attack. Actual deployment removes it once from storage;
it neither consumes generic gun stock nor issues another ammunition allowance.
Explicit empty selections remain empty. Stale, remote and duplicate selections
cannot create a gun. Occupied depots retain their records but cannot supply a
friendly battery. Stored and transported guns participate in the same global
identity checks as retained sectors and active deployments.

The published pesos transport networks remain in use. Organizing carts costs
180 pesos and a flotilla costs 400. Sending a piece adds no fee. One link takes
18 hours by cart or five by flotilla; the duration includes abstract loading.
Routes use controlled named-locality links. Flotillas require coastal localities
and no blockade. Assembled guns cannot cross mountain localities by cart.
Loss of route control, a blockade, capable enemies at the destination or a full
depot delays delivery. The hourly arrival check runs after same-hour raids and
blockade changes. Saved shipments resume with the same schedule and cargo.

These times, fees and restrictions are Granaderos tuning. This is not a claim
about classic JA2 artillery or a restoration of the obsolete resource economy.
There is one gun per shipment, at most 1,000 active shipments and 2,000 guns per
depot. No gun-weight, animal or bulk-capacity simulation is introduced. Loading
checks the local crew but does not assign that crew to the journey. There is no
cancellation, redirection, tactical convoy ambush, storage capture battle or
transport to arbitrary map cells in this delivery. The route parameters are
currently fixed; the cannon profiles and their crew requirements remain authored.

## Verification

Ten simulations and two mounted production-game checks pass **12/12**. The
earlier combined selection, profile, supply, emplacement and transport group
passes **37/37**; the final transport/emplacement group passes **22/22**. The
first complete run passed 1095/1095, but a separate malformed-facing probe found
an invalid stored orientation was accepted. After correcting shared gun
validation and adding transit/depot rejection and omitted-angle compatibility
cases, the final complete regression passes **1096/1096**, zero failures or skips
(266,619.887 ms), on the source above. Types, production export (722 files, 632
asset references) and all 36 reference comparisons pass. Documentation validation
passes with 243 requirements and 82 evidence records, preserving the original
50 and parity 87 rows.

The principal fixture buys its gun, wins the actual San Nicolás battle, fires an
ordinary shot, leaves the scene and buys carts. Dispatch, full save, hourly
arrival, squad travel to Buenos Aires, exact battery selection and actual attack
entry in Ensenada retain that gun with six reserves and no loaded charge. The
flotilla case buys its network and uses its five-hour link duration.

Prepared boundaries separately cover route occupation, blockade, known enemies,
full depots, crew availability and authored size, mountain/coastal restrictions,
wrong location or ownership, defeat, pending scenes, malformed schedules and
identity collisions. A declared 40% loading fraction isolates custody through
transit, storage and redeployment; real earned partial work is covered by the
[crew-loading delivery](artillery-crew-loading.md). The controls use the actual
production Home/Armory in a mounted DOM: they reject unorganized transport, send
one gun, show finite cargo and choose its exact depot record for a real attack.
These are not live-browser, campaign-balance or performance acceptance.

## Remaining work

TAC-08, ITEM-02 and overall integration remain partial. Gun trading, configurable
transport rules, advanced logistics, physical supplies and broader parity require
separate deliveries. The old [development transport record](../gameplay/campaign/artillery-transport.md)
has its own dated, larger-economy checks and does not establish these behaviors on
published main. Exact-head CI passed before publication.

## Publication

Published in [PR #106](https://github.com/fsodano/granaderos/pull/106) on 2026-09-28.
Exact head `e6eee1bbe2d627416e5c8040069a26c176acdffd` passed [CI run 36497971084](https://github.com/fsodano/granaderos/actions/runs/36497971084), including the full suite, types and production build. Merge commit: `57c06c71fed581375b380acdf55a4318398dcdfd`. This publication does not close the broader artillery or campaign requirements.
