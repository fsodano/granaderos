# Physical weapon attachment slots

Right-click a held or pocket firearm to inspect that exact physical slot. Its details now contain the available bayonet socket. Pick up an identified India-pattern bayonet, then click the socket to install it. A rifle can stay in its pocket during this work. Clicking the ordinary hand or pocket remains an equipment exchange, so the player chooses whether to replace the held object or modify its weapon assembly.

Click a fitted socket with an empty cursor to remove its bayonet. The exact bayonet becomes a saved cursor item even when every pocket is full. Place it in a chosen pocket, hand, or existing map transfer destination. Escape tries compatible pockets, then the owner's ground location. It does not refit the bayonet for free or replace the host rifle. If the ground cannot accept the item, cursor custody remains intact.

A different compatible bayonet on the cursor exchanges with an occupied socket. The incoming bayonet becomes part of the rifle; the outgoing bayonet stays on the cursor. Each retains its own identity, condition and custom item details. A broken bayonet can be removed but cannot be installed. Unmarked legacy bayonets and incompatible firearm models remain ineligible.

Combat costs retain the current period-game values: 12 AP to install, 8 AP to remove, and 20 AP to exchange. The preview checks the entire cost and both current item fingerprints. An invalid or unaffordable confirmation changes no ownership, AP, clock, condition or random state. Attachment handling lowers firearm readiness and clears old attack guards. Tactical exploration spends ordinary handling time without spending or refilling AP. Safe campaign inventory handling consumes neither AP nor campaign time, and does not require entering the sector to arrange carried equipment.

Loaded ammunition, ignition failures, unfinished loading, firearm condition, pocket order and the other hand remain with their original objects. The same plans run in tactical and campaign inventory. Existing access checks still reject unavailable soldiers, pending encounters, foreign sectors and a second active cursor owner.

A fitted bayonet can now retain safe custom data, such as its original name, in optional metadata. Current condition stays authoritative after wear or repair. Old four-field fittings still load. The existing canonical weight and host-pattern rules remain; metadata cannot override those fields or contain hidden equipment identities. Legacy fit/remove commands use the same conversion helpers.

## Reference and adaptation

The pinned [classic-compatible item interface](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Items.cc#L1895-L2065) installs a cursor object through the item description's attachment area and removes an attachment onto the item pointer. It supports the same description interaction in tactical and map inventory. This supplies the control model; the AP values, period socket compatibility and explicit Escape return are Granaderos adaptations.

This closes the cursor-to-attachment and detach-to-cursor gaps for the existing bayonet. It does not add other bayonet patterns, permanent attachments, modern weapon accessories or artwork. Other inventory and campaign parity requirements remain tracked in [the audit](ja2-parity-audit.md).

## Verification

The complete suite passes 2,147 tests with no skips. Typecheck, the production build, static export validation and diff whitespace checks pass.

Twenty-eight new tests cover metadata and old saves, paid tactical fitting and exchange, full-pack removal, cursor saves, chosen-pocket placement, stored rifles, unavailable actors, stale confirmations, safe campaign handling and actual finite purchases. Campaign cases include deployment, report and reentry. Independent review also checked three physically separate identical stored rifles from one aggregate record, and completed handling followed by collapse during exploration.

Live production-component checks passed:

- Held rifle: fit 100 → 88 AP, remove → 80 AP; loaded round, eight reserve cartridges, 83% firearm condition and 9.4 kg total weight stay unchanged.
- Detached 79% bayonet: save and restore on the cursor, then place in small pocket 8 without extra AP.
- Stored rifle: fit → 68 AP while the prepared firearm remains loaded; the stored rifle keeps its 53% condition, empty load and ignition failure.
- Exchange: replace the stored rifle's 79% bayonet with a 62% bayonet for 20 AP; the 79% item returns to the cursor.
- Full pack: all twelve pockets stay occupied; removal spends 8 AP, the cursor survives save/load, and Escape leaves the same bayonet on the ground with no extra AP.
- Insufficient AP: the 12 AP fitting is unavailable with 11 AP; cursor custody remains.
- Campaign: a paid hire and finite purchased bayonet fit, save, detach, save and move to a chosen pocket while the displayed clock remains 0 hours and treasury remains 3,080 pesos.

The temporary practice screen has separate disposable tactical and campaign states and does not access the user's campaign storage. No browser errors or warnings were reported in these checks.
