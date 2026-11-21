# Tools and supplies in the second hand

In tactical exploration, turn-based combat, and the campaign sector equipment panel, a soldier's second hand can hold tools, supplies, or non-weapon pocket items alongside a one-handed weapon or empty main hand. This extends the existing [two-hand weapon layout](two-hand-equipment.md); it does not claim complete inventory parity.

The second hand can hold a dressing, torch, ration, cartridge, other carried supply, tool, or non-weapon pocket item. It uses the existing owned record. One held item is removed from the pocket count, while the rest of that quantity still needs pocket space. Item condition, identity, weight, and quantity remain unchanged. A displaced blade or second pistol needs a real pocket.

In the tactical inventory, select an item and use **Poner en segunda mano**. Placement and stowing each cost 4 AP in combat. Exploration uses time without AP. A long gun prevents placement because it occupies both hands. Switching to a long gun puts the second-hand item in a pocket and clears its hand selection; the switch fails atomically if the equipment does not fit.

Select the second hand to prepare a dressing, usable supply, or tool in the main hand. It then uses the existing contextual interaction: dressings treat wounds, torches target a tile, and tools operate on compatible scenery. This preparation costs the ordinary 4 AP. It selects the exact tool or supply held there. Items without a supported use can now also move to the main hand; they remain available for giving or dropping and do not become improvised weapons. See [ordinary hand objects](main-hand-objects.md).

**Manos libres** also puts away a selected second-hand item. Stealing an enemy weapon requires both hands to be free. Dropping or transferring a held item removes it from its previous hand when its quantity is exhausted. A depleted supply contributes no occupied hand or pocket.

The sector equipment panel supports the same placement and stow choices for a present, conscious soldier in a safe sector. Existing ground discovery and travel restrictions remain in force. The hand reference survives reports, full campaign saves, reentry, capture, and rescue. It is an owned-item reference, not another custodian or duplicate record. The public state exposes the player's hand reference and keeps enemy inventory private.

Direct [dragging between hands and pockets](equipment-dragging.md) and ordinary-object placement in the main hand are available. Each hand retains the original JA2 single-item limit; hand slots hold one item, not a stack. Selected [pocket stack quantities](pocket-stack-quantities.md) are available. Two pistols load independently. [Paired fire and its accuracy tradeoff](paired-pistol-fire.md) use the normal cursor, with independent gun states and saved ownership. [Automatic paired loading](paired-pistol-reload.md) uses R and empty-fire clicks, with exact supplies, AP boundaries and independent partial work.
