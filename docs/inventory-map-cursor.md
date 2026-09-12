# Selected inventory items on the tactical map

## Controls

Open a soldier's inventory. Click a hand, garment or occupied pocket to select one item. Shift selects the pocket stack; the quantity field can choose part of it. Then click a destination on the tactical map:

- The soldier's own tile or adjacent reachable ground: leave the selected quantity there.
- A nearby squad member: pass the selected quantity. A valid chain of nearby squad members can relay it.
- Distant ground or a distant squad member: toss it, subject to range and a clear physical arc. A failed catch leaves the exact stack at the recipient's feet.
- Right-click a character: switch between handing the object to that character and placing it on the ground at that location. Right-click ground or press Escape to cancel.

The selected quantity stays in its original slot until the reducer accepts the action. A refused click retains the selection and cannot become a movement, treatment, shot, conversation or artillery order. Closing inventory, changing the actor or battle, losing control, or changing the selected contents cancels it. Equipped medical supplies still treat through ordinary use; selecting supplies from inventory transfers them instead.

The field displays item, quantity, destination, action and rejection reason. A toss displays its reviewed arc and a destination mark. Combat displays the AP cost and remaining AP; exploration does not spend or display AP. Map pointer movement within one unchanged body target does not repeatedly update the target state. The floating item visual already follows the pointer without rerendering the battlefield for each pixel.

## Ownership, geometry and persistence

`extractEquipmentSelection` validates the physical source and its fingerprint before extracting. It reduces that exact partial pocket, or empties that exact hand or garment slot, while preserving packed copies, the other hand and all finite item metadata. Selected quantities must fit the source and recipient. Changed recipients or relay positions reject a previously confirmed route. New piles use unique IDs and respect save admission's collection bound.

Ordinary tossing has its own bounded parabolic geometry. It checks ground height, walls, doors, props, carts and floor slabs. Exact intersections prevent thin obstacles from falling between display samples. At most 65 points are returned for drawing. The geometry does not inspect any actor roster or perform an aimed knife attack. Landings name their actual supported floor. Existing campaign/save ownership carries the resulting items without a new save schema.

## JA2 reference and remaining scope

The [publisher manual, pages 22–25](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf?t=1502453641) distinguishes the inventory pointer from prepared-item use. The classic implementation covers [cursor selection and trajectories](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L2822-L3083), [drop/pass/toss execution](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L3323-L3558), and the [right-click alternative](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Turn_Based_Input.cc#L758-L764).

This milestone retains Granaderos tuning: 4 AP per pass sender, 8 AP for a toss, six-cell toss range and 2 receiver AP on a successful combat catch. The catch formula and arc are not the classic formulas. Original JA2 could inflict [one point of generic tossed-object collision damage](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TileEngine/Physics.cc#L1903-L1917); this transport action ignores bodies and does no damage.

Selected-cursor gifts to authored NPCs explicitly refuse without consuming an item; existing equipped quest gifts are separate. Dragging directly from a slot to the map, walking to a distant drop instead of tossing, toss flight animation, and classic individual stack-member selection remain open. The current field preview shows the trajectory before the immediate accepted transfer. Touch and pen input have not been checked on physical devices. This does not establish full inventory or gameplay parity.

## Verification

Automated coverage checks exact source partitions, hand and outfit singletons, fitted loaded weapon metadata, stale and invalid orders, AP and control windows, finite catch outcomes, relay route changes, hidden-body equivalence, geometry and collection limits. Campaign tests use fresh paid recruitment and purchases, actual deployment, save/load, return/reentry and recovery. UI tests exercise shared nested providers, accepted/refused transactions and the production map/NPC callbacks.

Live production-component checks on 12 September 2026 used a separate two-soldier fixture without a saved campaign. Passing one dressing reduced Dorrego's five to four. Right-clicking Cabral switched the next dressing to ground placement at his feet, leaving Dorrego with three. Tossing seven cartridges reduced the selected pocket from 20 to 13 while the separate five-cartridge pocket stayed unchanged. The map showed the reviewed arc before confirmation.

In combat, a pass displayed and spent 4 AP (100 to 96). An out-of-range click retained the item and did not spend AP. A valid toss then displayed and spent 8 AP (96 to 88). Exploration versions spent no AP. Automated lifecycle coverage is broader than the controlled live fixture; a full authored campaign traversal was not repeated for this change.

The final review also checked the inventory floor selector without losing the selected item. A bandage landed on the upper E8 platform, and changing from Cabral to Acosta reset ground placement to a recipient toss with an 85% catch preview. Escape canceled the next selection without moving any supplies. The final preview reported no browser errors or warnings.

Final validation: **2,007/2,007 tests pass**. Typecheck and production build/static export pass (960 output files, 856 asset references). The pre-existing elevation-interface test now resolves the real scoped floor-control child before invoking its callback; it continues to verify paid climb admission and native Tab behavior.
