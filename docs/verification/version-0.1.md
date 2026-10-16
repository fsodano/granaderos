# Version 0.1 — playable development checkpoint

Date: 10 October 2026. Git tag: **`0.1`**. Package and build version: **`0.1.0`**.

This checkpoint records the browser game already on `main` at
`80423887bbd74046043c0811061c517c31f94fef`, with documentation corrections and
version metadata. It adds no gameplay features. The tag identifies the source;
it does not certify final campaign balance, full JA2 parity or release performance.

[Project README](../../README.md) · [Documentation index](../README.md) ·
[Future campaign authoring](../plans/campaign-authoring.md)

## Available now

- Spanish campaign and tactical controls, recruitment, paid service, independent
  squads, medical care, repair, militia and period campaign progression.
- Finite carried equipment and ammunition, persistent wounds and deaths,
  physical sector objects, capture and bounded joint prisoner evacuation.
- Native Three.js actors, shared wall edges, doors, windows, structural damage
  and visible firearm projectiles. The accepted asset work is merged.
- Browser autosaves and JSON save export/import for admitted current-format
  campaigns. Storage remains specific to a browser profile and site origin.
- A story editor at `/story` and sector editor at `/editor`. The story editor
  supports bounded content editing, chapters, dialogue, errands and an editable
  example, [La ruta de las postas](../development/example-post-campaign.md).

Equipment commerce is disabled. Equipment and supplies come from actual
recruitment allocations and physical objects in sectors. Renewal, return and
save/load do not refill spent supplies. The economy uses pesos; removed raw
material production and horse-care systems are not requirements for this version.
See the [finite editor scope](finite-campaign-editor-2026-10-05.md).

## Campaign creation is future work

The owner intends to design campaigns and allow other people to design their
own. A complete creator and sharing workflow is future work. Existing editors
and the example demonstrate subsets; they do not establish a finished platform
for arbitrary geography, factions, historical roles, multi-actor scenes or
portable campaign distribution. This checkpoint does not implement that expansion.

The [campaign authoring plan](../plans/campaign-authoring.md) defines that direction
and separates available tools from work still required.

## Known limits

The latest wall integration records passing local builds and focused checks,
plus a quick run of 7,101 tests. That quick run excluded 13 extended files and
predates later checkpoint additions. Its final partition contains 971 files,
including 14 extended files. These are dated results, not a new full result for
this tag. See [the exact scope](wall-edges.md#local-build-checks).

Later bounded checks prove actual combat, finite supply, casualties and saved
replay. They leave complete recovery, Cuyo, ending and opening acceptance open:

- Recovery reaches an inaccessible Córdoba travel route.
- Cuyo has earned artillery procurement and preparation checks; mountain combat
  and subsequent stages are not accepted by those checks.
- Stock northern and later preparation checkpoints pass, but the complete ending
  still needs a combined fresh run.
- The opening continuation wins its rear raid. Its survivors still bleed, and a
  bounded coastal detour ends from exhaustion. Later supply arrival, care and
  mission completion remain unverified.

These are observed route limits. They do not alone distinguish a game defect
from a test controller or strategy problem. Preserve real costs, wounds, deaths
and finite supplies when resolving them. See [campaign rechecks and later
continuations](wall-edges.md#campaign-recheck).

Other open acceptance work includes manual player campaigns across seeds and
forces, balance, all control and accessibility paths, sustained performance on
recorded hardware, and complete visual, audio and historical review. The
[accepted 3D record](latest-3d-gameplay-2026-10-08.md) establishes its named paths,
not every motion or sustained frame performance.

The new wall format covers all shipped maps and templates. Compatibility with
campaign saves from earlier wall formats is outside that delivery's accepted
scope. Keep an exported backup; start a new campaign if an old save is rejected.
Do not treat a successful import as proof of every later continuation.

## Documentation and evidence

This page is the current summary for version 0.1. The
[requirement register](requirements.json) and
[generated ledger](published-progress.md) retain broad and bounded requirements
with their recorded evidence. Their rows and old test totals overlap and are not
a completion percentage. Dated audits, failed runs and earlier development
versions remain historical records; inclusion in the repository does not make
their claims current.

## Validation of this checkpoint

Local checks completed on 10 October 2026:

- Documentation generation and audit passed: 275 requirements and 150 evidence
  references. Recorded requirement statuses and historical check results were
  preserved.
- Local links and heading anchors passed: 528 Markdown files and 2,739 links,
  with no missing files or anchors. Optional engine references were resolved
  against the initialized primary checkout; external URLs were not checked.
- Documentation audit tests passed: 10 tests, no failures or skips.
- Test runner and suite controls passed: 20 tests, no failures or skips. The
  shard inventory covers all 973 test files exactly once; this checks the
  inventory, not their gameplay results.
- TypeScript validation and the production build passed. The static export
  contains 1,377 files and 1,045 validated asset references.
- Version metadata agrees on `0.1.0`; the build source digest is
  `9765b28310c4e44dfd0d6941880447f19dae384e849be6c259c9de0d0426fbbc`.
- `git diff --check` passed.

Campaign checks were stopped at the owner's request. Campaign validation is
separate planned work and is excluded from this checkpoint's evidence. No
passing full-suite or browser campaign acceptance result is claimed for this tag.

## Publication

The requested publication is a source commit on `main` and the annotated `0.1`
tag. At that checkpoint, Pages deployment required a separate manual action.
Current `main` pushes build and publish the verified export automatically; tag
pushes do not start a deployment. The live site serves the last successful build.
See [the development guide](../development/getting-started.md#github-pages).
