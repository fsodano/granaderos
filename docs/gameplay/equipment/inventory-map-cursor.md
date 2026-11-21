# Selected inventory items on the tactical map

During tactical exploration and turn-based combat, players can pick up an item or partial stack from a soldier's inventory onto the cursor and click the tactical map to drop it on nearby ground, pass or relay it to squad members, toss it across distance, or offer it to a visible NPC in exploration.

## Controls

Open a soldier's inventory. Click a hand, garment or occupied pocket to select one item. Shift selects the pocket stack; the quantity field can choose part of it. Then click a destination on the tactical map:

- The soldier's own tile or adjacent reachable ground: leave the selected quantity there.
- A nearby squad member: pass the selected quantity. A valid chain of nearby squad members can relay it.
- Distant ground or a distant squad member: toss it, subject to range and a clear physical arc. A failed catch leaves the exact stack at the recipient's feet.
- A visible NPC during exploration: approach and offer the selected object. Acceptance is decided at contact. Special characters answer through their portrait panel; ordinary civilians give a brief refusal. See [selected NPC gifts](../characters/selected-npc-gifts.md).
- Right-click a character: switch between handing the object to that character and placing it on the ground at that location. Right-click ground or press Escape to cancel.

The selected quantity is now removed from its slot into [durable cursor custody](equipment-cursor-exchanges.md). An invalid order retains the cursor and cannot become movement, treatment, a shot, conversation or artillery order. An NPC refusal retains the exact cursor object. Focus and panel changes never discard it; loading restores it. Equipped medical supplies still treat through ordinary use; selecting supplies from inventory transfers or offers them instead.

The field displays item, quantity, destination, action and rejection reason. A toss displays its reviewed arc and a destination mark. Combat displays the AP cost and remaining AP; exploration does not spend or display AP. Map pointer movement within one unchanged body target does not repeatedly update the target state. The floating item visual already follows the pointer without rerendering the battlefield for each pixel.

## Ownership, geometry and persistence

`extractEquipmentSelection` validates the physical source or durable cursor and its fingerprint before extracting. It reduces that exact partial pocket, or empties that exact hand or garment slot, while preserving packed copies, the other hand and all finite item metadata. Selected quantities must fit the source and recipient. Changed recipients or relay positions reject a previously confirmed route. New piles use unique IDs and respect save admission's collection bound.

Ordinary tossing has its own bounded parabolic geometry. It checks ground height, walls, doors, props, carts and floor slabs. Exact intersections prevent thin obstacles from falling between display samples. At most 65 points are returned for drawing. The geometry does not inspect any actor roster or perform an aimed knife attack. Landings name their actual supported floor. Existing campaign/save ownership carries the resulting items without a new save schema.

## JA2 reference and remaining scope

The [publisher manual, pages 22–25](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf?t=1502453641) distinguishes the inventory pointer from prepared-item use. The classic implementation covers [cursor selection and trajectories](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L2822-L3083), [drop/pass/toss execution](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L3323-L3558), and the [right-click alternative](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Turn_Based_Input.cc#L758-L764).

This transport action retains Granaderos tuning: 4 AP per pass sender, 8 AP for a toss, six-cell toss range and 2 receiver AP on a successful combat catch. The catch formula and arc are not the classic formulas. Original JA2 could inflict [one point of generic tossed-object collision damage](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TileEngine/Physics.cc#L1903-L1917); this transport action ignores bodies and does no damage.

Selected-cursor gifts support the existing Retiro poncho errand with direct replies and automatic progress; the [gift record](../characters/selected-npc-gifts.md) states its limits. Dragging directly from a slot to the map, walking to a distant drop instead of tossing, toss flight animation, and classic individual stack-member selection remain open. The current field preview shows the trajectory before the immediate accepted transfer. Full inventory and gameplay parity remain open.
