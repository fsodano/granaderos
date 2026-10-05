# Finite campaign editor — 5 October 2026

The reachable story editor still offered automatic ammunition buying, free
dressings, imported equipment and artillery trade. The campaign already rejects
those orders. This contradicted the user's decision to defer shops and obtain
equipment through recruitment and physical sector objects.

The campaign rules form now exposes initial funds and one-time initial charges.
The ammunition-provider, import, artillery-supply and artillery-trade forms are
removed. Medical rules retain actual treatment, rest and bleeding controls, with
no dressing-price control or promise of free replenishment. Owned artillery,
transport, model definitions, care and paid service rules remain available.

Imported packages retain their old price and commerce fields through active
edits, undo, reset, export and launch. The parsers, saved rules and campaign
commerce guard are unchanged. This is a UI correction, not a shop implementation
or a new ammunition grant.

## Actual mounted acceptance

The complete story-editor test file imports an actual package through the file
input, edits active funds/ammunition/care values, exercises undo and both reset
buttons, exports the real download and launches a separately saved campaign.
Every imported legacy field retains its value at these boundaries.

An actual six-hour paid Acosta arrival issues seven finite initial cartridges.
Unloading and storing two leaves five with their owner. A paid renewal and sector
entry preserve those five without buying more, and the two stored rounds remain
in the depot. Medical and equipment purchase attempts fail atomically. Official
saved admission retains the package, charges and two initial dressings.

Four obsolete commerce-panel authoring cases were removed. The cartridge-price
case now verifies the mounted finite route and imported-field preservation.
Two campaign reentry cases performed the same round-trip; the one retaining an
explicit old price remains. Current engine commerce-rejection, care, initial
ammunition, artillery-model and transport coverage is retained. No test file or
suite exclusion was added or removed.

The first full story-editor diagnostic passed 73 of 74 cases. Its only failure
was an existing lookup of the renamed initial-cartridge label. The lookup was
corrected; the failed log is preserved at
`/tmp/granaderos-finite-campaign-editor-story-diagnostic.log`. The final candidate
also renames the funds heading to reflect one-time initial ammunition.

## Campaign and combat scope

A separate native campaign continuation used the unchanged merged PR181 engine.
It resumed the exact 352-order save, paid 13,200 pesos for Henri Beaumont's hire
and renewal, admitted his real six-hour arrival and consumed one owned dressing
during one hour of Weiss's care. Petrona stayed alive and resting in Mendoza.
The party reached the actual Uspallata assault boundary after 18 travel hours.
The 17-order suffix replays exactly from its original saved input, with official
save round-trips. All 45 prior deaths, both captives and the Tucumán loss remain.
This is not a full campaign ending or an original 314-order replay on new rules.

The final native checkpoint is at 369 orders, hour 1661:488, with 90,253 pesos.
The final save is
`/tmp/granaderos-stock-pr181-uspallata-20261005/accepted.save.json`, SHA-256
`3ab31b466e19f730a65af2da8093a8a736538d2b2211326d655a01b5b4d36faa`.
The public readiness receipt confirms the journey is ready with zero remaining
travel time. No native tactical action or victory is claimed.

The older wounded Silva checkpoint still has no proved protective-cover route.
Public allies block the corridor behind him, an observed enemy blocks the front,
and the stone ground is not a door or physical shot barrier. A single lower-aim
and running plan also exposes no protective destination. These read-only checks
justify a different legal route plan, not an AP or damage adjustment. The original
292-order result and all injuries remain preserved.

## Final validation

All final processes completed successfully on the frozen candidate:

| Check | Terminal result |
| --- | --- |
| Five complete affected test files | 87/87 passed; no failures, cancellations, skips or TODOs |
| Unfiltered `npm run test:quick` | 4,971/4,971 passed in all 715/715 files; no failures, cancellations, skips or TODOs |
| Suite partition | 723 files: 715 short and the same eight extended exclusions |
| Shard coverage and self-tests | All 723 files covered once; 5/5 self-tests passed |
| Typecheck and production build | Passed; 1,133 static files and 1,033 asset references verified |
| Documentation and baseline audits | Passed |
| Whitespace check | Passed |

Production digest:
`11bfa5266e533a05ca0495233d9db94d9015db0ecaf01790ff5c2723cf870175`
(build ID `11bfa5266e53`). Tests and support digest:
`84a5955613f091288781c91eb5693ac29852674ad32eeec67f4a4ef8c994ea30`.
The frozen input check passed again after the processes ended. Final documentation
corrections received another documentation audit and whitespace check.

Long campaign and artwork suites are not claimed for this UI-only batch.
Gameplay source, 3D assets, the running server and primary checkout are outside
the patch. The separate campaign continuation above supplies bounded gameplay
evidence, not a full campaign ending.
