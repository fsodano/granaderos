# Physical weapon attachment slots

In tactical exploration, turn-based combat, and the campaign equipment screen, right-click a held or pocket firearm to inspect that exact physical slot. Its details now contain the available bayonet socket. Pick up an identified India-pattern bayonet, then click the socket to install it. A rifle can stay in its pocket during this work. Clicking the ordinary hand or pocket remains an equipment exchange, so the player chooses whether to replace the held object or modify its weapon assembly.

Click a fitted socket with an empty cursor to remove its bayonet. The exact bayonet becomes a saved cursor item even when every pocket is full. Place it in a chosen pocket, hand, or existing map transfer destination. Escape tries compatible pockets, then the owner's ground location. It does not refit the bayonet for free or replace the host rifle. If the ground cannot accept the item, cursor custody remains intact.

A different compatible bayonet on the cursor exchanges with an occupied socket. The incoming bayonet becomes part of the rifle; the outgoing bayonet stays on the cursor. Each retains its own identity, condition and custom item details. A broken bayonet can be removed but cannot be installed. Unmarked legacy bayonets and incompatible firearm models remain ineligible.

Combat costs retain the current period-game values: 12 AP to install, 8 AP to remove, and 20 AP to exchange. The preview checks the entire cost and both current item fingerprints. An invalid or unaffordable confirmation changes no ownership, AP, clock, condition or random state. Attachment handling lowers firearm readiness and clears old attack guards. Tactical exploration spends ordinary handling time without spending or refilling AP. Safe campaign inventory handling consumes neither AP nor campaign time, and does not require entering the sector to arrange carried equipment.

Loaded ammunition, ignition failures, unfinished loading, firearm condition, pocket order and the other hand remain with their original objects. The same plans run in tactical and campaign inventory. Existing access checks still reject unavailable soldiers, pending encounters, foreign sectors and a second active cursor owner.

A fitted bayonet can retain safe custom data, such as its original name, in optional metadata. Current condition stays authoritative after wear or repair. Old four-field fittings still load. The existing canonical weight and host-pattern rules remain; metadata cannot override those fields or contain hidden equipment identities. Legacy fit/remove commands use the same conversion helpers.

## Reference and adaptation

The pinned [classic-compatible item interface](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L1895-L2065) installs a cursor object through the item description's attachment area and removes an attachment onto the item pointer. It supports the same description interaction in tactical and map inventory. This supplies the control model; the AP values, period socket compatibility and explicit Escape return are Granaderos adaptations.

Cursor fitting, exchange and removal cover the existing bayonet. They do not add other bayonet patterns, permanent attachments, modern weapon accessories or artwork. Other inventory and campaign parity requirements are tracked in [the parity requirements](../../requirements/ja2-parity.md).
