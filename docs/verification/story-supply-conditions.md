# Personal supply conditions in dialogue and campaign chapters

Runtime/test source: `78fdb5b9c802326e6a49fd9ec2be530a70dea9db`.

The story editor can require a specific character to hold an inclusive minimum
and optional maximum quantity of priming, flints, rations, torches, dressings or
boleadoras. Minimum and maximum zero require empty stock. Quantities must be
integers within the supported saved stock limits (one million dressings,
one hundred thousand of each other personal supply).

The check uses the holder's current quantities. A deployed soldier or named
mission ally must have its matching open scene; a missing or unrelated scene
cannot substitute an earlier service-sheet quantity, including for an empty-stock
condition. A loaded resident uses its current civilian stock. Outside deployment,
the persistent service record supplies the retained quantity. Allocated stock
alone does not imply life, world presence or service: authors can combine those
conditions explicitly.

Conditions do not grant, transfer, consume or reserve items. A player must obtain
or spend supplies through existing actions. Dialogue checks again when a choice
is selected. Campaign failure can use a validated current tactical checkpoint;
chapter completion waits for scene settlement. Existing completed chapters keep
their result. Referenced characters cannot be removed from dialogue or chapter
authoring until their conditions are removed.

## Verification

Five simulations cover:

- All six supply types, strict content ranges, rejected malformed references and
  unchanged identity for older packages without the optional condition.
- Actual finite military first aid and saved continuation: the current two, one
  and zero dressings differ from the deployed service snapshot. Unrelated scenes
  and missing scenes are unknown. Departure settles zero; an actual paid workshop
  purchase changes it to three.
- Actual collection from a critical authored resident, two finite first-aid
  strokes, a stock-gated dialogue response and saved chapter completion. The
  resident stays empty and the caregiver retains exactly five dressings.
- An authored failure at zero dressings occurs after the actual second treatment,
  with no premature failure from absent tactical state.
- The actual named San Lorenzo ally spends its ration and reports zero before the
  service sheet is acknowledged. A prepared territorial approach isolates the
  existing role; it is not a full route.

Two mounted editor cases cover quantity limits, undo, copy, empty maximum,
reference protection, pinned launch and a chapter completed by an actual paid
three-dressing purchase. The focused simulation group passes five checks; the
filtered editor/simulation group passes seven overlapping checks. The latter
includes one existing starting-supply case and excludes the named-ally case.
An initial named-ally save fixture omitted clock synchronization; it was corrected
to confirm the actual orders before save. The complete release run passes **886/886 tests**, with zero failures or skips,
in 210,947.431 ms. Types, production export (722 files, 632 asset references),
all 36 baseline comparisons and the documentation audit pass (220 requirements,
59 evidence records, preserving all 50 original and 87 parity rows).
[PR #82](https://github.com/fsodano/granaderos/pull/82) merged after
[GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36443357146/job/108999241427)
passed at `440b05a7857e8ad7fb34906e17e75d5909f85721`. The resulting main commit
is `ed16346acc98d71fdfa078fb0eaa3de1322dd273` (28 September, 15:41 UTC).

## Limits

This delivery adds conditions for the six existing personal supplies. Weapon,
armour, ammunition, container, merchant and arbitrary quest-item conditions remain
separate work, as do finite dialogue transfers. Mounted DOM and simulation checks
do not establish browser or loaded-combat performance acceptance.
