# Starting territorial control and loyalty

The story package can set patriot/royalist ownership and whole-number loyalty
from 0 to 100 for the thirteen existing campaign localities. Explicit maps require
all thirteen keys and exactly those two values per locality. Unknown cells,
partial maps and unsupported owner types are rejected. Missing maps retain the
original Retiro-only start and original loyalty values.

At this checkpoint, Retiro remains the headquarters and supply origin and must
start patriot. The later [headquarters delivery](campaign-headquarters.md) adds
an explicit choice with corresponding supply, workshop and loss rules. The
editor explains this constraint. Districts share their locality's control; open
land stays neutral. Character appearance cells remain independent of ownership.

Composition applies only at new-campaign creation. It grants no captured-sector
reward, quest result, troops or militia. Real arrivals require control and a
plausible reception site. Supply still requires a connected friendly route from
Retiro; controlling Mendoza alone does not create one. Income and militia
eligibility use actual campaign control and loyalty. Later saved changes are
preserved, and editing the draft cannot change the pinned campaign.

The Rules table supports original defaults, undo/redo and launch validation. The
desk reports the initial controlled localities. The strategic map displays the
current saved ownership and loyalty instead of reusing initial choices.

## Verification

Runtime source: `275d98d60df50d715ed906dc7058f596c62aec87`.
The full suite passed **717/717 tests**, with no failures or skips (186122 ms).
Types, production export (721 files, 631 asset references), all 36 numerical
baseline checks and the documentation audit passed. The register retains
188 requirements and 27 evidence records.
[PR #50](https://github.com/fsodano/granaderos/pull/50) was accepted at
`d8806e9fde2f2a09703c6837e7af6c180c2a331c` after
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36381500171/job/108798018240)
passed; merge commit `cf60d95390798fa640c2dd62e16701e38f25b62b`.

- `tests/starting-territory.test.mjs`: complete schema, limits, invalid maps,
  ordinary/older defaults, no free results or forces, actual hire arrival in a
  configured destination and rejection in an occupied one, supply connectivity,
  daily income through waiting/save, city militia eligibility, district/open-land
  ownership, actual travel and peaceful entry, return and attack on an occupied
  neighbor, draft isolation and altered-content rejection.
- A prepared established-territory save checks later ownership and loyalty
  preservation. It is not evidence of fighting and winning those territories.
- `tests/story-editor.test.mjs`: mounted controls change ownership and loyalty,
  undo/redo, reject an invalid limit, restore defaults and recover edited values,
  then launch a real saved campaign and hire a soldier to the chosen locality.
- `tests/starting-territory-render.test.mjs`: actual desk and strategic-map markup
  show authored starting territories, selected loyalty and later current control.
  This is rendered-component evidence, not a live browser interaction.
- Existing Retiro start/render cases retain the standard opening. The first
  focused test assumed the wrong display order for arrival options; comparing
  the required destination set corrected the assertion without changing the game.

## Limits

TERRITORY-01 is bounded; STORY-05 and STORY-07 remain partial. Other headquarters were still missing at this checkpoint. Independent rural
ownership, additional factions, authored initial forces and
fortifications, campaign role identities, chapters and endings remain open.
Arbitrary starting choices are not certified as balanced or completable. No second
complete campaign, live-browser or sustained loaded-battle acceptance is claimed.
