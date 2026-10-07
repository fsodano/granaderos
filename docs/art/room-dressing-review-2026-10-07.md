# Room dressing review — 7 October 2026

The fourteen [building templates](../../game/map-templates.js) define furnished
rooms. Their retained names provide the reference for room use. The municipal
archive previously received washroom items, the governor's reception room
received a kitchen hearth, and the family bedroom received kitchen dressing.
These errors came from room order.

Recognized Spanish or English room names now select archive, office, reception,
bedroom, kitchen, washroom, store or workshop dressing. A supported explicit
`purpose` takes priority. Unnamed rooms and unrecognized names keep the earlier
building and room-order fallback. Ruined rooms keep their existing ruin treatment.
The current fourteen templates preserve room names when compiled; this change
does not add a map schema field or alter furniture authored in the templates.

The new items use timber shelves, storage chests, pottery, rugs,
candles, hearths and washstands. Archive and office shelves contain ledgers and
tied paper; storage and kitchen shelves retain their containers. No modern appliances from the supplied gameplay
references are added. This is a functional dressing correction, not a claim that
these rooms reproduce a measured historical interior.

Decoration stays on existing free floor cells, outside furniture footprints and
door approaches, at the room's physical level. It remains nonblocking and passes
through the existing room-disclosure checks. Tests cover all fourteen compiled
templates in four rotations, fresh campaign maps, malformed floor candidates,
and hidden versus revealed archive items in both renderers. These checks establish
placement and disclosure. The playable fourteen-template catalogue now visits
the rooms through normal door and movement orders. Live exterior, partial and
interior captures produced 84 views across four rotations with no browser errors.
The Casa rural and Cabildo de villa interiors were inspected for furniture scale,
room dressing and cutaways. These samples do not prove every historical interior
detail or replace the remaining facade comparison.
