# Inventory cursor exchanges

Picking up an item in the tactical inventory (exploration or combat) or the campaign equipment panel now removes it from its physical slot. The exact item lives in a saved `equipmentCursor` record on its owner until it is placed, passed, thrown, given or returned. The pointer display does not own another copy.

## Controls and placement

Click takes one item; Shift-click takes the complete pocket stack. Click a destination to place it. A different item in that slot becomes the cursor item. This works with a full pack, including when the displaced item cannot fit the original source slot. Identity, condition, load, partial reload work and attachments stay with each object.

Matching pockets fill to their stack limit. The remainder stays on the cursor. The quantity field chooses how much of the cursor stack to place next. Hands and clothing hold one item each. If the incoming stack exceeds an occupied destination's capacity, the outgoing item must first fit elsewhere in the pack; otherwise the complete attempted placement is refused. This avoids having two different objects on one cursor.

A two-handed gun blocks the other hand. If both hands are occupied, installing it requires an empty compatible pocket for the offhand object. The displaced main-hand object becomes the cursor item. Two one-handed objects remain independent, including two units of the same supply.

Rearrangement within the same soldier's hands, clothing and pockets costs no AP, time or energy. Reloading, attachments and map transfers retain their separate action costs.

Right-click a slot to inspect its contents. Escape explicitly returns the cursor item: try the original slot, then compatible pockets, then the owner's current ground cell and floor. The original slot can itself exchange an item; earlier placements are not undone. If the final ground placement cannot be stored, the return is refused and custody remains intact. Escape return is a browser adaptation, not a claim about the classic tactical Escape key.

The game does not forget a cursor item on window blur or component unmount. Tactical Done and changing the selected soldier require placing or returning it first. Cursor state restores after loading. A drag sends one pickup/placement transaction on release; an invalid destination leaves a valid picked object on the cursor. A stale source never starts custody.

## State and lifecycle

The pure planner models all physical slots, applies the complete exchange, then reconstructs existing equipment records. Stowed weapon aliases can become explicit inventory weapon records; the physical items and their metadata remain unchanged. The old source index is a return hint, not a reserved slot.

The same cursor payload participates in battle and campaign validation, identity checks, ammunition accounting, body loot and report/deployment round trips. It is excluded from pocket capacity and equipped-item use, but included in carried weight. Ordinary cursor pickup is blocked while another available soldier owns the active cursor. Unavailable actors can retain recoverable custody if no ground fallback fits; this must not invalidate a later heal, release or save.

Named or otherwise customized weapons preserve their extra item data through hands, cursor, rout drops, armory replacement, used-weapon trade, save and deployment. Storage-row IDs remain separate from item data. Reserved weapon fields and malformed custom weights are rejected at admission.

Combat entry, end-turn and an actor becoming unavailable attempt to return the cursor. A full ground collection never authorizes item deletion. The map transfer path consumes the cursor directly, including partial quantities and NPC refusal, which retains the unaccepted object.

## Primary references

The [publisher manual, pages 21–25](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf?t=1502453641) describes hands, finite pocket sizes and one/all pickup. The pinned classic-compatible implementation provides the detailed behavior:

- [Physical pickup](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L2664-L2714).
- [Slot fit, swaps, oversized stacks and two-hand handling](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Items.cc#L1730-L2050).
- [Return and cursor serialization](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L5086-L5159).
- [Placement AP and cursor owner](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Panels.cc#L1548-L1585).

Individual stack-member inspection, direct slot-to-map dragging, further attachment types and classic transfer/AP formulas remain separate gaps. [Physical weapon attachment slots](attachment-slots.md) preserve custom bayonet data and support cursor fitting, exchange and removal from held or stored rifles. Full JA2 inventory and gameplay parity remain open.
