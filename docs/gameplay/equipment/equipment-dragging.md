# Dragging equipment between hands, pockets and outfits

In the tactical inventory during exploration and combat, players can drag equipment between both hands, the twelve pockets and the general outfit slot. Click placement shares the same physical slots and placement rules, including the general outfit slot. Right-click opens item details or cancels a pending selection. See [click placement](equipment-click-placement.md) for the shared controls and outfit exchanges.

Drag an item from a pocket to a compatible hand. Drag a held item into a pocket to stow it. Dropping onto an occupied pocket exchanges its item with the held item if both fit and the pocket item can occupy that hand. Dropping onto a hand uses the existing equipment selection and displacement rules. Pocket-to-pocket moves retain the existing whole-pocket arrangement behavior.

Hand changes use the existing four-AP selection cost; installing a packed weapon uses six AP. Pocket arrangement is free. Exploration advances time for hand changes without charging AP. Hand placement moves one item from a supply stack; selection of a different held quantity remains pending. Ordinary objects can occupy either hand; see [ordinary hand objects](main-hand-objects.md).

The preview and reducer share the placement plan. The source fingerprint includes load, condition, attachments, identity and stack contents at pickup. Both endpoints are checked before applying an order. Unavailable actors, changed contents, full packs, large objects in small pockets and the second hand blocked by a long gun reject without changing ownership or spending AP. Stowing one gun preserves the other occupied hand. Actual pocket destinations survive snapshot validation.

Pointer capture tracks the gesture through release, including a release outside the equipment area. It supports the browser's mouse, pen and touch pointer path. Click controls remain available.

This is not full inventory or JA2 parity. Pocket quantity selection uses [physical stack quantities](pocket-stack-quantities.md). Hands retain the original single-item limit. Simultaneous paired firing remains open. Campaign hand, pocket and outfit placement is available; see [campaign equipment dragging](campaign-equipment-dragging.md).
