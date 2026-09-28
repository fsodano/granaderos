# Authored firearm preparation and held firing position

Runtime/test source: `8573da89c2ee086ef8b7c9969e3df90386b1c542`.

The weapon editor can configure the existing preparation field and launch a
campaign with a nonzero value. Preparation is part of the authored first-shot
cost, not an additional charge: a 20-AP firearm with 7 AP of preparation costs
20 AP for its first shot and 13 AP for a later shot from the held position.
Skill discounts leave at least one AP for discharge. Aim cost remains separate.
Zero preparation preserves the previous per-shot cost. The default package,
older packages and unconfigured legacy firearms continue to use zero; their
content identity and first-shot balance do not change.

The firing position belongs to the actor. An accepted shot, including a failed
ignition, establishes it after payment. Ordinary turn boundaries, rejected orders
and free covering orders do not grant or remove it. Successful movement, reload,
repriming, stance/hand changes and other physical actions lower the gun. Paid
artillery crew work, defensive handling and bodyguard interception also lower it.
Collapse, death, knockdown, flight and weapon loss clear it. Recovery cannot grant
it back. A stored or collected gun carries its charges and partial loading work,
not its former holder's firing position. A fresh deployment starts lowered.

Active snapshots retain valid readiness and reject malformed or physically
impossible states before play resumes. The existing fire control explains the
preparation and discharge costs and changes to the held-position message after
an actual shot. Enemy fire and reaction fire use the same cost calculation.

## Verification

Nine simulations cover unchanged zero-preparation firearms; real consecutive
shots, finite charges, snapshots, turn continuation and skill discounts; accepted
and rejected actions; failed ignition and paid repriming; actual paid collection
from a prepared casualty and re-equipping without inherited readiness; invalid
and incapacitated states; actual enemy fire; and a real paid campaign deployment
with an active save and identical continuation. An exploration case checks the
actual displayed three seconds for the first shot and one second for the held
discharge, with unchanged combat AP and finite charges. The campaign save case uses
compact barrier geometry to isolate the boundary; it is not a full route.

One mounted editor case covers authoring, strict limits, undo/redo, pinned launch
and actual paid deployment. One mounted battlefield case uses the ordinary
pointer target and keyboard activation for two shots with the displayed 20/13 AP
costs and saved continuation. Changing the fire cursor alone does not prepare the
weapon. The initial combined simulation group passes 41 tests; the two mounted cases also
pass. The final filtered group passes 12 checks, including the eleven new cases
and one existing campaign-project editor check. The first diagnostic legacy check exposed readiness values inherited from
old reference data; the adapter now explicitly keeps unconfigured firearms at
zero, matching the existing package policy.

The first full source (`72d12368f9a13b72af1e362ad38ea710692d5411`) passes
903/903 tests, zero failures/skips (207,938.262 ms), types, export and all 36
baseline comparisons. A subsequent control review replaced the exploration AP
label with actual seconds and added the clock regression. The final complete source passes **904/904 tests**, zero failures or skips
(209,648.849 ms), types, production export (722 files, 632 asset references), all
36 baseline comparisons and the documentation audit (222 requirements and 61
evidence records, retaining all 50 original and 87 parity rows). Exact-head
GitHub CI remains required before merge.

## Limits

This delivery supports the authored firearm preparation field. Paid directional
turning, explicit look/raise orders, two independently held firearms, strategic
physical ammunition custody and complete JA2 readiness parity remain separate.
Mounted DOM checks do not establish live-browser usability or performance.

## Publication

[PR #84](https://github.com/fsodano/granaderos/pull/84) merged at
2026-09-28 16:21:55 UTC as `51dee5c579166dfcb27939b628c9a85ea2db7093`.
[GitHub verification](https://github.com/fsodano/granaderos/actions/runs/36448362783/job/109016421266)
passed at 16:20:50 UTC for the exact PR head
`2949a944ce8513c9901f587c104be551f4575f64`.
