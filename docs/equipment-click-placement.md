# Click placement across personal equipment

Current behavior: [durable cursor exchanges](equipment-cursor-exchanges.md) supersede the source-reservation, cancellation and rearrangement-cost behavior recorded below. The checks below describe the earlier milestone.


The tactical inventory and campaign equipment panel share one item selection across both hands, the outfit slot, four large pockets and eight small pockets. Left-click an occupied slot to select its item, then click a compatible destination to place it. The selected item follows the mouse cursor. Selection does not remove the item from its source or spend AP.

Right-click an item to inspect it. If an item is selected, right-click or Escape cancels placement first. A second Escape can close the tactical inventory. Clicking outside the equipment slots, leaving the window, changing soldiers or closing the panel also cancels selection. Keyboard activation uses the same slot controls. Dragging remains available and sends one placement order on release; the following browser click cannot place or select the item again.

Hands, pockets and outfits use the same authoritative placement preview and reducer. The pending selection records the source contents. Changed equipment, unavailable soldiers, incompatible sizes, occupied hands and capacity limits reject the order without changing ownership. Invalid click destinations keep the selection and show the reason. Item identity, condition, gun charges, fittings and stack contents remain subject to the existing equipment rules.

The outfit is a finite garment. It can move to an empty compatible hand or large pocket. Wearing another garment returns the old garment to the exact vacated slot. Swapping two garments retains their separate identities and conditions. A small pocket or a slot occupied by a different kind of item cannot receive this outfit exchange. Changing an outfit costs 8 AP in combat, advances one second without AP in exploration, and costs no AP or time in campaign arrangement. Existing hand and pocket placement costs remain unchanged.

## Verification

Automated checks cover the shared controller, actual pointer handlers and rendered components, plus finite outfit transactions and campaign save/deployment. They exercise canceled drags, secondary pointers, stale sources, occupied slots, separate garments, rejected exchanges and AP/time accounting. Pointer tests invoke the actual hook handlers; they do not establish physical touch or pen verification.

The final full suite passes 1,922 tests. Typecheck and production build/static export pass. The export verifies 960 files and 856 asset references. The scene-render regression also checks smooth sampling for both illustrated body and skin layers.

Live checks used separate tactical and campaign fixtures with production components. Tactical checks covered click placement between hands and pockets, garment exchange, wearing and removing a garment through a hand, equivalent-stack merging, keyboard placement, invalid destinations, right-click inspection and Escape cancellation. Combat placement spent 4 AP for a hand change and 8 AP per outfit change. A real mouse drag exchanged garments once and spent exactly 8 AP. Campaign placement and save/load retained the rifle's chosen pocket, held dressings and worn garment. These fixtures did not use the user's campaign save.

This is an inventory interaction milestone, not full JA2 inventory parity. Pocket quantity selection is now implemented with [physical partial stacks](pocket-stack-quantities.md). Hands retain the original single-item limit. Direct ground-item dragging and further fitting types remain separate work. Existing supported attachment controls remain in item details and equipment accessories.
