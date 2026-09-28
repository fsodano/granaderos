# Import ports and saved weapon delivery windows

Story authors can select Buenos Aires, Ensenada, San Nicolás or Santa Fe as the
import port, or disable new imported-weapon orders. Minimum and maximum delivery
hours are integers from 1 to 720, with an inclusive range and minimum no greater
than maximum. Equal values produce a fixed delay. Older packages retain Ensenada
and 72–120 hours. Brown Bess/Baker families and their authored variants retain
their existing imported classification.

Orders require a controlled port, willing foreign merchants and the existing
headquarters armory access. Payment occurs once. A seeded due time is sampled at
purchase and stored; reload does not reroll it. A blockade or occupied port holds
an overdue shipment without changing its due time or charging again. Same-hour
raids now resolve before delivery. Availability after the delay releases each
shipment once into the published general armory. Authored instances can then be
equipped and deployed with their own names, images and statistics.

Disabling new imports does not remove carried equipment or local purchases. A
save with disabled imports cannot contain outstanding imported orders. Rules are
pinned with content, so draft edits cannot redirect an active campaign's orders.
The mounted armory displays actual port, delay range and delay reasons and disables
unavailable orders. Editor controls support limits, undo/redo and original defaults.

## Verification

Final runtime source: `c5787476d3082c8ea1b85e1d1aed55e646680d7d`.

- `tests/import-supply-rules.test.mjs`: schema, all four eligible ports, disabled
  orders, bounds and legacy defaults; actual payment, seeded deadline, save,
  unique delivery, equipping and active battle save; occupied/blocked reception,
  hostile trade, continued local purchases and pre-existing carried imports;
  pinned definitions and rejected altered content.
- Occupation and clearing a blockade use explicit prepared political states to
  isolate reception. A separate case advances a real coastal campaign clock to a
  due-hour naval raid. Review reproduced premature delivery, then the regression
  passed after moving delivery behind that hour's raids. Clearing the retained
  blockade for final delivery is prepared, not a naval victory playthrough.
- Twenty focused import and hire-arrival checks passed after the ordering fix.
- `tests/story-editor.test.mjs`: mounted authoring, undo, limit rejection, original
  defaults, disable/re-enable, launch and actual delivered order; actual armory
  purchase and displayed port/range; disabled, occupied and blocked states keep
  local purchases available and explain the delivery condition.
- Existing legacy imports and authored firearm cases remain in the full suite.

Release validation on the final runtime: **736/736 tests**, zero failures or skips
(186,057 ms); type check; production export (721 files, 631 asset references);
36 baseline checks; documentation audit (190 requirements, including all 50
original and 87 parity rows, and 29 evidence records). Exact-head GitHub checks
are required before merge.

## Limits

IMPORT-01 is bounded; equipment, economy and general rule authoring remain partial.
Imported-family selection, finite merchant stocks, physical port depots, cargo
transport, cancellation/refunds and independent historical campaign roles remain
open. Reception retains the published ownership/blockade model; this does not
integrate advanced port defense or physical cargo. No complete campaign, live
browser or sustained loaded-battle performance acceptance is claimed.
