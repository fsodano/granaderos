# Authored foundry project and workshop

A campaign can author the foundry locality, foundry name, army name, organization
cost and funding cost. Eleven existing land localities are supported; water cells
and isolated mountain passes are rejected. Costs are whole pesos from zero to one
million. Missing configuration retains Mendoza, El Plumerillo and the original
500/3000-peso costs. The assigned engineer still needs current living, free service.

Preparation requires control of the configured locality. It applies one payment,
one completion flag and one local loyalty event there. Subsequent army funding
uses its own authored price and remains a one-time action. Completed preparation
persists when its engineer leaves. A completed project also provides the actual
repair/resupply service at that locality, requiring control and supply connectivity.
Existing workshops are preserved.

Editor controls support validation, undo/redo, restoration and playable launch.
Treasury text, availability, payments and logs use the names and prices. Original
chapter text and the commander's preparation hint follow the project names and
funding amount, while the original Cuyo route gates remain explicit.

## Verification

Runtime source: `b212d117b421c054596212aa74075758902602c6`.

- `tests/foundry-project.test.mjs`: all supported locality definitions, rejected
  malformed/unsupported configurations, legacy defaults and pinned save admission.
  Actual paid arrival in Salta, journey to Jujuy, preparation, repair/resupply,
  funding, peaceful entry and saved return work without Mendoza control. The
  loyalty reward belongs to Jujuy and neither payment can repeat.
- Worn supplies are prepared to isolate existing repair/resupply prices and access.
  Prepared occupation and broken supply block services while retaining completed
  preparation. Free preparation/funding work with zero treasury. Insufficient
  funds produce no charge, completion flag or loyalty reward.
- Original progression still displays its Cuyo requirements alongside the authored
  project name and price; it does not become a new campaign route automatically.
- `tests/story-editor.test.mjs`: actual mounted location/name/price editing,
  invalid-value rejection, undo/redo, reset, launch and saved payments. Actual
  treasury controls display and charge the configured project and army.
- Seventy-nine focused project, role, headquarters, legacy and editor checks passed.

Release checks: **774/774 tests**, zero failures or skips (187,399 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (194 requirements, all 50 original and 87 parity rows,
33 evidence records); 114 changed local links. Exact-head GitHub checks are
required before merge.

Accepted in [PR #56](https://github.com/fsodano/granaderos/pull/56) at
`a16f58ee128d75518ec940c60e5be77ca9105048`, with
[successful exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36388812936/job/108819869666).
Merged into `main` as `9acd4fe28a627586307c2cf6ccd70a1b6139562e`.

## Limits

FOUNDRY-01 configures one strategic project. It does not create or move tactical
buildings, rename the geographic map, change original missions or replace their
Cuyo control, artillery and fortification requirements. The subsequent [project conditions delivery](project-conditions.md) connects
preparation/funding to chapters and dialogue. Other economic services, artillery
authoring, faction/world composition and complete alternate-campaign acceptance
remain open. No complete historical
campaign, live browser session or sustained loaded-combat performance is claimed.
