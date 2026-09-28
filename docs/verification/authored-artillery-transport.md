# Authored artillery transport rules

Runtime/test source: `07f74aea7065707d1ea98a423aa0cfd379fda0e5`.

The story editor exposes **Reglas → Traslado de artillería**. A campaign can
permit or disable new gun transfers and set hours per route link and one dispatch
fee for carts and flotillas. Durations are whole hours from one to 168. Fees are
whole pesos from zero to 1,000,000. Zero means a free dispatch. Defaults preserve
the existing 18-hour cart links, five-hour flotilla links and no dispatch fee.
Organizing either transport network remains a separate existing purchase.

These optional definitions are pinned in the campaign package. Older packages
keep their identity when the field is absent. Partial objects, extra keys and
invalid types or limits are rejected. Editor undo/redo, original-rule reset,
validation, export and saved launch preserve the definitions. Later draft edits
do not change a running campaign.

The armory and dispatch use the same quote. The fee is paid once, at dispatch,
without advancing time. An unaffordable or disabled transfer keeps the gun and
funds unchanged. A repeated order cannot charge again. The schedule uses the
pinned duration multiplied by the actual controlled path length; save validation
rejects a substituted duration. Blockade, route occupation, enemies at destination
and capacity still delay delivery without another fee. Crew, coastal and mountain
restrictions and exact finite ammunition remain in force.

These are Granaderos parameters. The editor does not remove geographical or
crew requirements. It does not yet configure network purchase prices, generic
squad travel, transport capacity, convoy combat or arbitrary-cell cargo routes.

## Verification

Four new simulations, two mounted production-armory checks and one mounted
editor case pass **7/7**. The transport overlap passes **18/18**, plus the editor
case. Complete regression passes **1103/1103**, zero failures or skips (266,110.238 ms). Types, production export (722 files, 632 asset references), all 36 baseline comparisons and documentation validation (244 requirements, 83 evidence records) pass. The original 50 and parity 87 rows remain.

The actual purchase/victory/shot fixture runs with authored cart and flotilla
rules. A three-hour cart shipment costs 37 pesos; a two-hour flotilla shipment
costs 19. Full saves, arrival and changed external drafts preserve both rules
and the original unloaded gun with six reserves. The disabled campaign is a
real authored start. Prepared funds and occupation boundaries isolate rejection
and delay: zero funds after an exactly affordable dispatch stay zero after a
repeat; interrupted arrival preserves its three-hour due time and never charges
again. A substituted old 18-hour schedule is rejected on load.

Mounted Home/Armory controls show the actual price and duration, send the gun
and save the deducted funds; the unaffordable control stays disabled without
moving the gun. The mounted editor covers every field, undo/redo, invalid zero
hours, reset and a pinned saved launch. The first focused run exposed a missing
supported-package registration, which blocked campaign creation and editor
launch. The registration was corrected; all focused checks then passed. These
are mounted DOM and simulation checks, not live-browser or performance results.

## Remaining work

The broader artillery, item and story-rule requirements remain partial. Trading,
physical stock, configurable general transport and advanced logistics are
separate deliveries. See the [finite transport boundary](finite-artillery-transport.md).
Exact-head CI remains required before publication.
