# Physical pocket stacks and quantity selection

Current behavior: [durable cursor exchanges](equipment-cursor-exchanges.md) supersede the source-reservation, cancellation and rearrangement-cost behavior recorded below. The checks below describe the earlier milestone.


Left-click picks one item from the selected pocket. Shift-click picks that pocket's whole stack. A compact quantity field and **Todo** button allow an exact amount without a keyboard modifier. Pointer dragging uses the same rules. The selection changes no ownership or AP until a destination accepts an order.

An empty pocket receives the chosen quantity. Compatible stacks combine up to the destination's limit. If only part fits, the accepted amount moves and the remainder stays selected at its actual source. A hand receives one item and leaves the rest selected. Escape or right-click cancels only the pending remainder; it does not undo a completed placement. A changed source invalidates the pending selection.

Partial stacks occupy separate real pockets. Their chosen quantities and positions survive inventory updates, other equipment changes and saves. Picking one item for a hand reduces the selected pocket; putting a held item into a pocket places that one item. Newly received supplies fill existing partial stacks before using another pocket. Equivalent loose objects may combine; weapons, tools, garments and identified items retain their individual records and metadata. Pocket rearrangement consumes no AP or time, including in combat; hand and outfit changes retain their existing costs.

Saved pocket counts describe placement within an existing owned total. They cannot add items. Depleted totals cap remaining partitions, malformed or oversized counts reject at admission, and bounded overflow retains quantities that no longer fit. Four large and eight small pockets remain common to all soldiers.

## Original behavior and adaptations

Classic JA2's `BeginItemPointer` selects one object normally and the entire slot with Shift. The original manual's inventory section describes Shift selection as well. See the [classic pointer implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc) and the [publisher-distributed manual, page 22](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf?t=1502453641).

`ItemSlotLimit` limits each hand and worn slot to one object. `PlaceObject` and stack operations retain a remainder when only part fits. See the [classic item implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Items.cc). Earlier audit notes incorrectly listed multiple-item hand stacks as required parity work; this milestone corrects that assumption. Pocket quantities and cursor quantities are distinct from hand occupancy.

The numeric quantity field is a Granaderos convenience. Classic JA2 also has a popup for selecting individual stack members; Granaderos still uses its existing item details panel. Catalog stack limits remain period-game tuning, including the existing bulk distinction between large and small pockets. This work does not establish full inventory parity: individual member selection, full cursor-driven exchanges with other item types and further fittings need separate verification or work. Selected quantities can now be passed, dropped and tossed through the [tactical map cursor](inventory-map-cursor.md).

## Verification

Automated checks cover bounded allocation, actual finite split/merge orders, hand and outfit changes, additions and consumption, rejection, save admission, campaign arrangement, save/reentry, and real UI handlers for normal, Shift and partial placement. Physical touch and pen use remain unverified.

The final full suite passes 1,961 tests. Typecheck and production build/static export pass, including 960 output files and 856 asset references.

Live production-component checks used separate tactical and campaign fixtures. Normal pickup moved one cartridge; a chosen seven-cartridge split preserved the other stacks. Shift selection filled a 19-cartridge pocket to 20 and retained four selected cartridges, which then moved to another pocket. A real mouse drag filled a four-cartridge pocket to 20, retained four selected at the source, and canceled that remainder without changing either stack. Preparing one of five dressings retained four selected; choosing two and stowing the held dressing left separate stacks of two and three. The total weight stayed unchanged.

In the campaign panel, a 50-unit priming supply split into 17 and 33 in chosen pockets. Saving, moving one unit elsewhere and loading restored the exact 17/33 layout and empty destination. Campaign time stayed at zero. Both browser previews reported no errors or warnings; neither used the user's campaign save.

The live combat check selected five dressings, put one in the main hand for 4 AP (100 to 96), then placed the four-item remainder into a large pocket without further AP expenditure.
