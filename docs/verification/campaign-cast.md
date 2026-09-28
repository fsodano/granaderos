# Independent campaign casts

With authored chapter progression, historical characters can be removed or copied
as independent residents. The original progression retains its mandatory cast.
Character, quest, dialogue and successor references still protect deletion.
Removed characters have no fallback encounters, contact-directory entries or
service records in a new campaign. Optional `includeOriginalResidents` controls
only generic original map residents; absent values retain legacy behavior.

A copied historical sheet retains editable identity presentation, attributes,
equipment, abilities and placement in a new identity. It starts as a locally
recruitable permanent resident with zero pay, experience progression and no
historical recruitment requirements. No implicit mission, workshop or global
marching power transfers to it. Editor-generated IDs reserve original slots even
when their characters were removed. An empty catalogue can still create the free
player officer. The treasury omits unavailable historical foundry preparation.

## Verification

Runtime source: `e12d99a476615b7f1793e43ce6a46a35c7fba46b`.

- `tests/campaign-cast.test.mjs`: real paid arrival, exact-cell travel/entry,
  dialogue quest completion and saved victory with only two independently authored
  identities; no original roster records, contacts or restored encounters. Stock
  and older-package defaults, optional generic residents, invalid options, content
  pinning and a rejected injected absent actor are covered. An empty cast creates
  a free officer, visits a real peaceful sector and saves on return.
- `tests/story-editor.test.mjs`: copy San Martín into an independent resident,
  preserve sheet/portrait/placement, rename, remove the original, undo/redo, toggle
  generic residents, reject missing historical-mode cast, launch, locally recruit,
  save and march with ordinary fatigue. A separate empty-cast editor case creates
  a new identity outside reserved slots and completes a real paid arrival.
- `tests/campaign-cast-render.test.mjs`: actual treasury rendering omits a removed
  foundry role and retains the usable armory; the original treasury remains intact.
- Forty-nine focused cast/editor/render checks passed. The first focused run caught
  a missing runtime helper import and two changed UI-test selectors; these were
  corrected before the passing run.

Release checks: **758/758 tests**, zero failures or skips (187,666 ms); type check;
production export (721 files, 631 asset references); 36 baseline checks; documentation
audit (192 requirements, all 50 original and 87 parity rows, 31 evidence records);
110 changed local links. Accepted in
[PR #54](https://github.com/fsodano/granaderos/pull/54) at
`7ed3071eb4935d5332ae5ea68d0e3d07c91abbc1`, with
[successful exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36386862263/job/108813938115).
Merged into `main` as `ccbf848ed55c8e19408c0f6139dc870277682406`.

## Limits

CAST-01 covers cast composition, not the complete world. This short two-person
route is not a second full campaign acceptance. At this checkpoint historical recruitment gates and strategic functions remained
on retained historical identities; copies do not inherit them automatically. The
subsequent [role assignment delivery](campaign-roles.md) explicitly assigns the
foundry and marching privileges. Other mission roles remain separate. Factions, opposition commanders, diplomacy, calendar raids and world
geography still require authoring. Generic residents can be omitted and replaced
with new inhabitants, but their original municipal quests are not automatically
converted into editable quest definitions. No full historical campaign, live
browser or sustained loaded-combat performance acceptance is claimed.
