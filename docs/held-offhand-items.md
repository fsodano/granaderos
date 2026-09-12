# Tools and supplies in the second hand

Implemented 12 September 2026. This extends the existing two-hand weapon layout; it does not claim complete inventory parity.

The second hand can hold a dressing, torch, ration, cartridge, other carried supply, tool, or non-weapon pocket item. It uses the existing owned record. One held item is removed from the pocket count, while the rest of that quantity still needs pocket space. Item condition, identity, weight, and quantity remain unchanged. A displaced blade or second pistol needs a real pocket.

In the tactical inventory, select an item and use **Poner en segunda mano**. Placement and stowing each cost 4 AP in combat. Exploration uses time without AP. A long gun prevents placement because it occupies both hands. Switching to a long gun puts the second-hand item in a pocket and clears its hand selection; the switch fails atomically if the equipment does not fit.

Select the second hand to prepare a dressing, usable supply, or tool in the main hand. It then uses the existing contextual interaction: dressings treat wounds, torches target a tile, and tools operate on compatible scenery. This preparation costs the ordinary 4 AP. It selects the exact tool or supply held there. Items without a supported use remain selectable for giving or dropping; they do not become improvised weapons.

**Manos libres** also puts away a selected second-hand item. Stealing an enemy weapon requires both hands to be free. Dropping or transferring a held item removes it from its previous hand when its quantity is exhausted. A depleted supply contributes no occupied hand or pocket.

The sector equipment panel supports the same placement and stow choices for a present, conscious soldier in a safe sector. Existing ground discovery and travel restrictions remain in force. The hand reference survives reports, full campaign saves, reentry, capture, and rescue. It is an owned-item reference, not another custodian or duplicate record. The public state exposes the player's hand reference and keeps enemy inventory private.

## Evidence

The full isolated gameplay suite passes 1,512 tests, including the fresh route through Yatasto. Type checking, the production build, and static export pass (278 files and 189 asset references).

- Ten focused tests cover finite quantity and pockets, displaced weapons, firing with a small gun, exact AP, contextual medical use, long-gun rejection, tool selection, arbitrary item identity, drop/transfer cleanup, exhausted ammunition, full-pack rollback, free-hands theft admission, map changes, campaign/save/reentry, and exploration time.
- The capture/rescue regression preserves a selected key, its identity and condition, alongside the existing independent pistol and outfit records.
- Live UI: a dressing moved from its pocket to the second hand for 4 AP (90 to 86). Selecting the hand prepared it for another 4 AP. Ordinary self-use cost 25 AP, consumed the dressing, stopped bleeding, and left health at 80. The long-gun example disabled second-hand placement. A key held in the second hand retained its 57% condition after tactical save validation/reload and left its former pocket empty.

Remaining inventory work includes general placement of inert objects in the main hand, selectable quantities held in each hand, and direct dragging between hands and pockets. Independent two-pistol loading is implemented; simultaneous paired fire and dedicated off-hand accuracy rules remain separate requirements.
